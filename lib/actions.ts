'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { rfidListHash, sha256Hex } from '@/lib/crypto';
import { parsePesadasCsv, resumenPesadas, conciliarCaravanas } from '@/lib/csv';
import { ADPV_MAX_KG_DIA, ADPV_MIN_KG_DIA, paso1Schema } from '@/lib/domain';
import { calcularDesembolsos, calcularLiquidacionFinal } from '@/lib/escrow';
import { consultarDeforestacion } from '@/lib/gfw';
import { parseAndValidatePolygon } from '@/lib/geo';
import {
  resolverVerificacionHumedal,
  type VerificacionHumedalGuardada,
} from '@/lib/humedales-servidor';
import {
  decidirReplay,
  ejecutarOrigen,
  huellaCreacion,
  verificarTitularidadLote,
  type EscrituraLote,
  type InputOrigen,
  type OrigenEstado,
  type ResultadoOrigen,
} from '@/lib/origen';
import {
  TOKEN_SAC_TESTNET_USDC,
  contextoAnclajeStellar,
  getStellarClient,
  transferirUsdcDemo,
  verificarTxOnChain,
} from '@/lib/stellar';
import { argsFondeo, argsSanidad, argsCierre, esWalletStellar } from '@/lib/stellar-args';
import { leerLoteOnChain } from '@/lib/stellar-read';
import { createAdminClient, sanitizarNombre, subirArchivo } from '@/lib/storage';

export type FormState = { errors: string[] };

const redondear = (n: number) => Math.round(n * 100) / 100;

async function leerArchivo(
  formData: FormData,
  name: string,
): Promise<{ buffer: Buffer; nombre: string } | null> {
  const value = formData.get(name);
  if (!(value instanceof File) || value.size === 0) return null;
  return { buffer: Buffer.from(await value.arrayBuffer()), nombre: value.name };
}

function mimeDocumento(nombre: string): string {
  const lower = nombre.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/pdf';
}

/**
 * Arma el núcleo de origen (`lib/origen.ts`) con las dependencias reales:
 * GFW, cliente Stellar y escrituras sobre `lotes` vía service_role.
 */
async function ejecutarOrigenDelLote(input: InputOrigen): Promise<ResultadoOrigen> {
  const admin = createAdminClient();

  const escribirLote = async ({ loteId, patch }: EscrituraLote) => {
    const { error } = await admin.from('lotes').update(patch).eq('id', loteId);
    return { error: error ? { message: error.message, code: error.code } : null };
  };

  return ejecutarOrigen(
    {
      consultarGfw: async ({ poligono }) => {
        const apiKey = process.env.GFW_API_KEY;
        if (!apiKey) {
          throw new Error('GFW_API_KEY no configurada en el entorno del servidor');
        }
        return consultarDeforestacion({ geometry: poligono, apiKey });
      },
      enviarOrigen: async (envio) => {
        const tx = await getStellarClient().createAndVerifyOrigin({
          codigoLote: envio.codigoLote,
          producerWallet: envio.productorWallet,
          renspaDocHash: envio.renspaDocHash,
          rfidListHash: envio.rfidListHash,
          eudrGeoHash: envio.eudrGeoHash,
          headCount: envio.headCount,
          initialAvgWeightKg: envio.initialAvgWeightKg,
          targetWeightKg: envio.targetWeightKg,
          financingAmount: envio.financingAmount,
          tokenSacAddress: TOKEN_SAC_TESTNET_USDC,
        });
        return { txHash: tx.txHash };
      },
      leerOnChain: (codigo) => leerLoteOnChain(codigo),
      modoAnclaje: () => contextoAnclajeStellar(),
      actualizarLote: escribirLote,
      registrarRechazo: escribirLote,
    },
    input,
  );
}

export async function crearLoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.rol !== 'PRODUCTOR') {
    return { errors: ['Esta acción requiere una cuenta con perfil de Productor.'] };
  }

  const admin = createAdminClient();
  const creacionKey = String(formData.get('creacion_key') ?? '').trim() || null;

  const parsed = paso1Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  const data = parsed.data;

  const geo = parseAndValidatePolygon(data.poligono);
  if (!geo.ok) return { errors: geo.errors };

  const archivoCsv = formData.get('archivo_rfid_csv');
  if (!(archivoCsv instanceof File) || archivoCsv.size === 0) {
    return { errors: ['Subí el archivo CSV del bastón lector (caravana_rfid,peso_kg)'] };
  }
  const csvText = await archivoCsv.text();
  const pesadas = parsePesadasCsv(csvText);
  if (pesadas.errors.length > 0 || pesadas.rows.length === 0) {
    return { errors: pesadas.errors.slice(0, 12) };
  }
  const resumen = resumenPesadas(pesadas.rows);
  const rfidHash = rfidListHash(pesadas.rows);

  const { data: existentes } = await admin
    .from('caravanas')
    .select('rfid')
    .in(
      'rfid',
      pesadas.rows.map((r) => r.rfid),
    );
  if (existentes && existentes.length > 0) {
    return {
      errors: [
        `Estas caravanas ya están registradas en otro lote activo: ${existentes
          .map((e) => e.rfid)
          .join(', ')}`,
      ],
    };
  }

  const productorNombre = String(formData.get('productor_nombre') ?? '').trim();
  const productorCuit = String(formData.get('productor_cuit') ?? '').trim();
  const productorWallet = String(formData.get('productor_wallet') ?? '').trim();
  if (!esWalletStellar(productorWallet)) {
    return {
      errors: [
        'Conectá tu wallet Freighter en Stellar Testnet (dirección G...) antes de registrar el lote.',
      ],
    };
  }

  let productorId: string | null = null;
  if (productorNombre) {
    const { data: productor } = await admin
      .from('productores')
      .upsert(
        {
          wallet: productorWallet,
          nombre_razon_social: productorNombre,
          cuit: productorCuit || '00-00000000-0',
        },
        { onConflict: 'wallet' },
      )
      .select('id')
      .single();
    productorId = productor?.id ?? null;
  }

  await admin.from('perfiles').update({ wallet: productorWallet }).eq('id', user.id);

  const monto = data.montoTotalFinanciacion;
  const kilosTotales = resumen.promedioKg * resumen.cantidad;

  const resultadoHumedal = await resolverVerificacionHumedal({
    poligonoTexto: data.poligono,
    usuarioId: user.id,
    verificacionId: String(formData.get('verificacion_humedal') ?? '').trim() || null,
  });
  if (!resultadoHumedal.ok) {
    return { errors: resultadoHumedal.errores };
  }
  const verificacion = resultadoHumedal.verificacion;

  // Chequeo temprano de idempotencia: la misma clave de envío con la misma
  // huella de datos reutiliza el lote; con datos distintos es un conflicto.
  let creacionHuella: string | null = null;
  if (creacionKey) {
    creacionHuella = huellaCreacion({
      renspa: data.renspa,
      poligonoHash: verificacion.poligonoHash,
      rfidHash,
      monto: data.montoTotalFinanciacion,
      cabezas: resumen.cantidad,
      pesoObjetivoKg: data.pesoObjetivoKg,
      categoria: data.categoria,
      raza: data.raza,
      tipoOperacion: data.tipoOperacion,
      tipoRodeo: data.tipoRodeo,
      plazoMeses: data.plazoMeses,
      fechaVigencia: data.fechaVigencia,
      moneda: data.moneda,
    });
    const { data: existente, error: errorReplay } = await admin
      .from('lotes')
      .select('codigo_lote, creacion_huella')
      .eq('creado_por', user.id)
      .eq('creacion_key', creacionKey)
      .maybeSingle();
    if (errorReplay) {
      return { errors: [`No se pudo comprobar la clave de envío: ${errorReplay.message}`] };
    }
    const decision = decidirReplay({
      existente: existente
        ? {
            codigoLote: String(existente.codigo_lote),
            creacionHuella: (existente.creacion_huella as string | null) ?? null,
          }
        : null,
      huella: creacionHuella,
    });
    if (decision.accion === 'redirigir') redirect(`/lotes/${decision.codigoLote}`);
    if (decision.accion === 'conflicto') return { errors: [decision.error] };
  }

  const { data: loteRow, error: insertError } = await admin
    .from('lotes')
    .insert({
      renspa: data.renspa,
      provincia: data.provincia,
      localidad: data.localidad,
      // Geometría única: el lote persiste el polígono normalizado de PostGIS,
      // el mismo que mide, hashea y compromete el manifiesto.
      poligono_geojson: verificacion.reporte.poligono,
      superficie_ha: verificacion.reporte.superficieLoteHa ?? geo.superficieHa,
      marca_liquida: data.marcaLiquida,
      tipo_operacion: data.tipoOperacion,
      categoria: data.categoria,
      raza: data.raza,
      tipo_rodeo: data.tipoRodeo,
      edad_meses: data.edadMeses ?? null,
      denticion: data.denticion ?? null,
      tratamiento_nutricional: data.tratamientoNutricional ?? null,
      moneda: data.moneda,
      monto_total_financiacion: monto,
      peso_objetivo_kg: data.pesoObjetivoKg,
      plazo_meses: data.plazoMeses,
      fecha_vigencia: data.fechaVigencia,
      descripcion_operacion: data.descripcionOperacion,
      productor_id: productorId,
      productor_wallet: productorWallet,
      cantidad_cabezas: resumen.cantidad,
      peso_promedio_kg: resumen.promedioKg,
      peso_min_kg: resumen.minKg,
      peso_max_kg: resumen.maxKg,
      uniformidad: resumen.uniformidad,
      precio_por_cabeza: redondear(monto / resumen.cantidad),
      precio_por_kg: redondear(monto / kilosTotales),
      titulo: `${resumen.cantidad} ${data.categoria} ${data.raza} - ${Math.round(resumen.promedioKg)} kg`,
      estado_publicacion: 'PENDIENTE_VALIDACION',
      porcentaje_humedal: verificacion.porcentajeTexto,
      fuente_humedal: verificacion.fuente,
      hash_verificacion_humedal: verificacion.reporteHash,
      estado_humedal: verificacion.estado,
      verificacion_humedal_id: verificacion.id,
      creado_por: user.id,
      creacion_key: creacionKey,
      creacion_huella: creacionHuella,
    })
    .select('id, codigo_lote')
    .single();

  if (insertError || !loteRow) {
    if (creacionKey && insertError?.code === '23505') {
      const { data: existente } = await admin
        .from('lotes')
        .select('codigo_lote, creacion_huella')
        .eq('creado_por', user.id)
        .eq('creacion_key', creacionKey)
        .maybeSingle();
      if (existente?.codigo_lote) {
        const decision = decidirReplay({
          existente: {
            codigoLote: String(existente.codigo_lote),
            creacionHuella: (existente.creacion_huella as string | null) ?? null,
          },
          huella: creacionHuella ?? '',
        });
        if (decision.accion === 'redirigir') redirect(`/lotes/${decision.codigoLote}`);
        if (decision.accion === 'conflicto') return { errors: [decision.error] };
      }
    }
    return { errors: [`No se pudo crear el lote: ${insertError?.message ?? 'error desconocido'}`] };
  }

  const codigo = String(loteRow.codigo_lote);

  const limpiarAltaParcial = async (detalle: string): Promise<FormState> => {
    try {
      await admin.from('lotes').delete().eq('id', loteRow.id);
    } catch {
      // Limpieza best-effort: el lote quedaría PENDIENTE_VALIDACION sin anclaje igualmente.
    }
    return {
      errors: [
        `No se pudo completar el registro del lote (${detalle}). El lote no quedó guardado; reintentá el alta.`,
      ],
    };
  };

  const renspaPdf = await leerArchivo(formData, 'renspa_pdf');
  let renspaDocUrl: string | null = null;
  let renspaDocHash: string | null = null;
  let boletoUrl: string | null = null;
  try {
    if (renspaPdf) {
      renspaDocUrl = await subirArchivo({
        bucket: 'documentos',
        path: `${codigo}/renspa-${sanitizarNombre(renspaPdf.nombre)}`,
        file: renspaPdf.buffer,
        contentType: mimeDocumento(renspaPdf.nombre),
      });
      renspaDocHash = sha256Hex(renspaPdf.buffer);
    }

    const boleto = await leerArchivo(formData, 'boleto_marca_pdf');
    if (boleto) {
      boletoUrl = await subirArchivo({
        bucket: 'documentos',
        path: `${codigo}/boleto-marca-${sanitizarNombre(boleto.nombre)}`,
        file: boleto.buffer,
        contentType: mimeDocumento(boleto.nombre),
      });
    }

    await subirArchivo({
      bucket: 'planillas',
      path: `${codigo}/pesadas-inicial.csv`,
      file: Buffer.from(csvText, 'utf8'),
      contentType: 'text/csv',
    });
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    return limpiarAltaParcial(`no se pudieron subir los documentos: ${detalle}`);
  }

  const { error: errorHashes } = await admin
    .from('lotes')
    .update({
      renspa_doc_url: renspaDocUrl,
      renspa_doc_hash: renspaDocHash,
      boleto_marca_url: boletoUrl,
      rfid_list_hash: rfidHash,
    })
    .eq('id', loteRow.id);
  if (errorHashes) {
    return limpiarAltaParcial(`no se guardaron los hashes de la evidencia: ${errorHashes.message}`);
  }

  const { error: errorCaravanas } = await admin.from('caravanas').insert(
    pesadas.rows.map((r) => ({
      lote_id: loteRow.id,
      rfid: r.rfid,
      peso_inicial_kg: r.pesoKg,
    })),
  );
  if (errorCaravanas) {
    return limpiarAltaParcial(`no se registraron las caravanas: ${errorCaravanas.message}`);
  }

  const resultado = await ejecutarOrigenDelLote({
    loteId: String(loteRow.id),
    codigoLote: codigo,
    poligono: verificacion.reporte.poligono,
    productorWallet,
    renspaDocHash: renspaDocHash ?? '',
    rfidHash,
    headCount: resumen.cantidad,
    initialAvgWeightKg: resumen.promedioKg,
    targetWeightKg: data.pesoObjetivoKg,
    financingAmount: monto,
    origenEstado: 'PENDIENTE',
    origenManifest: null,
    origenManifestHash: null,
    txHashExistente: null,
  });

  if (resultado.estado === 'rechazado') {
    redirect(`/lotes/${codigo}`);
  }
  if (resultado.estado !== 'confirmado' && resultado.estado !== 'sin_cambios') {
    return {
      errors: [
        `El lote ${codigo} se guardó y quedó PENDIENTE_VALIDACION. ${resultado.error} Reintentá desde la ficha del lote.`,
      ],
    };
  }

  redirect(`/lotes/${codigo}`);
}

export async function reintentarGfwAction(formData: FormData): Promise<void> {
  const codigo = String(formData.get('codigo') ?? '');
  if (!codigo) redirect('/');

  const user = await getCurrentUser();
  if (!user || user.rol !== 'PRODUCTOR') {
    redirect(
      `/lotes/${codigo}?error=${encodeURIComponent(
        'El reintento EUDR requiere una cuenta con perfil de Productor.',
      )}`,
    );
  }

  const admin = createAdminClient();
  const { data: lote } = await admin
    .from('lotes')
    .select('*')
    .eq('codigo_lote', codigo)
    .maybeSingle();
  if (!lote) redirect('/');

  const volverConError: (mensaje: string) => never = (mensaje) =>
    redirect(`/lotes/${codigo}?gfw=error&msg=${encodeURIComponent(mensaje)}`);

  const titularidad = verificarTitularidadLote({
    creadoPor: (lote.creado_por as string | null) ?? null,
    usuarioId: user.id,
  });
  if (!titularidad.ok) volverConError(titularidad.error);

  if (lote.seal_1_eudr) {
    volverConError('El Sello 1 ya fue emitido; su evidencia no se puede modificar.');
  }

  const origenEstado = ((lote.origen_estado as OrigenEstado | null) ?? 'PENDIENTE') as OrigenEstado;
  if (origenEstado === 'RECHAZADO') {
    volverConError(
      'Este lote fue rechazado por pérdida de bosque (EUDR). Su evidencia quedó congelada y no admite un nuevo anclaje.',
    );
  }

  // Un alta que quedó a medias (sin caravanas o sin su hash) no debe anclarse:
  // se anclaría un origen incompleto. Se exige rehacer el alta.
  const rfidHashLote = String(lote.rfid_list_hash ?? '').trim();
  const { count: caravanasCount } = await admin
    .from('caravanas')
    .select('id', { count: 'exact', head: true })
    .eq('lote_id', lote.id);
  if (!rfidHashLote || !caravanasCount) {
    volverConError(
      'El alta de este lote quedó incompleta (faltan las caravanas o su hash): el origen no puede anclarse así. Volvé a registrar el lote desde el formulario.',
    );
  }

  const manifiesto = (lote.origen_manifest as string | null) ?? null;
  const manifiestoHash = (lote.origen_manifest_hash as string | null) ?? null;

  // Si el manifiesto ya está preparado, se reutiliza tal cual (no se recalcula
  // humedales ni GFW). Solo los lotes legacy sin manifiesto lo reconstruyen.
  let verificacion: VerificacionHumedalGuardada | undefined;
  if (!manifiesto) {
    const resultadoHumedal = await resolverVerificacionHumedal({
      poligonoTexto: JSON.stringify(lote.poligono_geojson),
      usuarioId: user.id,
      verificacionId: lote.verificacion_humedal_id ? String(lote.verificacion_humedal_id) : null,
    });
    if (!resultadoHumedal.ok) {
      volverConError(resultadoHumedal.errores.join(' '));
    }
    verificacion = resultadoHumedal.verificacion;

    const { error: errorVerificacion } = await admin
      .from('lotes')
      .update({
        verificacion_humedal_id: verificacion.id,
        porcentaje_humedal: verificacion.porcentajeTexto,
        fuente_humedal: verificacion.fuente,
        hash_verificacion_humedal: verificacion.reporteHash,
        estado_humedal: verificacion.estado,
      })
      .eq('id', lote.id);
    if (errorVerificacion) {
      volverConError(
        `No se pudo guardar la verificación de humedales (${errorVerificacion.message}). Reintentá.`,
      );
    }
  }

  const resultado = await ejecutarOrigenDelLote({
    loteId: String(lote.id),
    codigoLote: codigo,
    poligono: lote.poligono_geojson,
    productorWallet: String(lote.productor_wallet ?? ''),
    renspaDocHash: String(lote.renspa_doc_hash ?? ''),
    rfidHash: rfidHashLote,
    headCount: Number(lote.cantidad_cabezas ?? 0),
    initialAvgWeightKg: Number(lote.peso_promedio_kg ?? 0),
    targetWeightKg: Number(lote.peso_objetivo_kg ?? 0),
    financingAmount: Number(lote.monto_total_financiacion ?? 0),
    origenEstado,
    origenManifest: manifiesto,
    origenManifestHash: manifiestoHash,
    txHashExistente: (lote.soroban_create_tx_hash as string | null) ?? null,
  });

  if (resultado.estado === 'rechazado' || resultado.estado === 'confirmado') {
    redirect(`/lotes/${codigo}`);
  }
  if (resultado.estado === 'sin_cambios') {
    volverConError('El origen de este lote ya está anclado; no hace falta reintentar.');
  }
  volverConError(resultado.error);
}

export async function fondearLoteAction(formData: FormData): Promise<void> {
  const codigo = String(formData.get('codigo') ?? '');
  if (!codigo) redirect('/');

  const user = await getCurrentUser();
  if (user && user.rol !== 'COMPRADOR') {
    redirect(
      `/lotes/${codigo}?error=${encodeURIComponent(
        'El fondeo de escrow requiere una cuenta con perfil de Comprador.',
      )}`,
    );
  }

  const buyerWallet = String(formData.get('buyer_wallet') ?? '').trim();
  const buyerNombre = String(formData.get('buyer_nombre') ?? '').trim() || 'Frigorifico Demo SA';

  const admin = createAdminClient();
  const { data: lote } = await admin
    .from('lotes')
    .select('*')
    .eq('codigo_lote', codigo)
    .maybeSingle();
  if (!lote) redirect('/');

  const volverConError: (mensaje: string) => never = (mensaje) =>
    redirect(`/lotes/${codigo}?error=${encodeURIComponent(mensaje)}`);

  if (lote.estado_publicacion !== 'DISPONIBLE' || !lote.seal_1_eudr) {
    volverConError('El lote no esta disponible para fondear');
  }
  if (!buyerWallet || !esWalletStellar(buyerWallet)) {
    volverConError('Conectá tu wallet Freighter en Stellar Testnet (G...) para fondear el lote');
  }
  if (
    lote.productor_wallet &&
    buyerWallet.toUpperCase() === String(lote.productor_wallet).toUpperCase()
  ) {
    volverConError('La wallet del comprador no puede ser la del productor (auto-compra bloqueada)');
  }

  const monto = Number(lote.monto_total_financiacion ?? 0);
  const desembolsos = calcularDesembolsos(monto);

  const txHashEnviado = String(formData.get('tx_hash') ?? '').trim();
  let txHash: string;

  if (txHashEnviado) {
    if (process.env.STELLAR_MODE === 'real' && process.env.NEXT_PUBLIC_STELLAR_CONTRACT_ID) {
      try {
        await verificarTxOnChain({
          txHash: txHashEnviado,
          wallet: buyerWallet,
          metodo: 'fund_lot_escrow',
          args: argsFondeo({ codigoLote: codigo, compradorWallet: buyerWallet, monto }),
        });
      } catch (err) {
        volverConError(
          `Error verificando transacción on-chain: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    txHash = txHashEnviado;
  } else {
    const tx = await getStellarClient().fundLotEscrow({
      codigoLote: codigo,
      buyerWallet,
      amount: monto,
    });
    txHash = tx.txHash;
  }

  await admin.from('compradores').upsert(
    {
      wallet: buyerWallet,
      razon_social: buyerNombre,
      cuit: '30-00000000-0',
      tipo_comprador: 'FRIGORIFICO_EXPORTADOR',
    },
    { onConflict: 'wallet' },
  );

  if (user) {
    await admin.from('perfiles').update({ wallet: buyerWallet }).eq('id', user.id);
  }

  await admin.from('movimientos_escrow').insert([
    {
      lote_id: lote.id,
      tipo: 'DEPOSIT_ESCROW',
      monto,
      moneda: lote.moneda,
      tx_hash: txHash,
    },
    {
      lote_id: lote.id,
      tipo: 'RELEASE_MILESTONE_1',
      monto: desembolsos.hito1,
      moneda: lote.moneda,
      tx_hash: txHash,
    },
  ]);

  await admin
    .from('lotes')
    .update({
      estado_publicacion: 'FINANCIADO_EN_ENGORDE',
      comprador_wallet: buyerWallet,
      funded_at: new Date().toISOString(),
      soroban_fund_tx_hash: txHash,
    })
    .eq('id', lote.id);

  redirect(`/lotes/${codigo}`);
}

export async function registrarAuditoriaAction(formData: FormData): Promise<void> {
  const codigo = String(formData.get('codigo') ?? '');
  const vetNombre = String(formData.get('vet_nombre') ?? '').trim();
  const matricula = String(formData.get('matricula') ?? '').trim();
  const vetWallet = String(formData.get('vet_wallet') ?? '').trim();
  const observaciones = String(formData.get('observaciones') ?? '').trim();
  const diasCiclo = Number(formData.get('dias_ciclo') ?? 120) || 120;

  const admin = createAdminClient();
  const { data: lote } = await admin
    .from('lotes')
    .select('*')
    .eq('codigo_lote', codigo)
    .maybeSingle();
  if (!lote) redirect('/');

  const volverConError: (mensaje: string) => never = (mensaje) =>
    redirect(`/lotes/${codigo}?error=${encodeURIComponent(mensaje)}`);

  if (!vetWallet || !esWalletStellar(vetWallet)) {
    volverConError(
      'Conectá tu wallet Freighter en Stellar Testnet (G...) para firmar la auditoría',
    );
  }

  const user = await getCurrentUser();
  if (user && user.rol !== 'VETERINARIO') {
    volverConError(
      'La auditoría sanitaria está reservada exclusivamente a Veterinarios acreditados. El productor y el comprador tienen prohibido este paso.',
    );
  }

  if (
    lote.estado_publicacion !== 'FINANCIADO_EN_ENGORDE' ||
    !lote.seal_1_eudr ||
    lote.seal_2_sanitary
  ) {
    volverConError('El lote no esta listo para la auditoria del Mes 4');
  }

  const archivoCsv = formData.get('csv_mes4');
  if (!(archivoCsv instanceof File) || archivoCsv.size === 0) {
    volverConError('Subi el CSV de la balanza del Mes 4');
  }

  const csvText = await archivoCsv.text();
  const pesadas = parsePesadasCsv(csvText);
  if (pesadas.errors.length > 0 || pesadas.rows.length === 0) {
    volverConError(pesadas.errors.slice(0, 6).join(' | '));
  }

  const { data: caravanas } = await admin
    .from('caravanas')
    .select('rfid, peso_inicial_kg')
    .eq('lote_id', lote.id);
  const padron = (caravanas ?? []).map((c) => String(c.rfid));
  const conciliacion = conciliarCaravanas(
    padron,
    pesadas.rows.map((r) => r.rfid),
  );
  if (!conciliacion.ok) {
    volverConError(
      `Conciliacion RFID fallo. Faltantes: ${conciliacion.faltantes.join(', ') || 'ninguna'}. Ajenas: ${conciliacion.ajenas.join(', ') || 'ninguna'}`,
    );
  }

  const resumen = resumenPesadas(pesadas.rows);
  const pesoInicial = Number(lote.peso_promedio_kg ?? 0);
  const adpv = (resumen.promedioKg - pesoInicial) / diasCiclo;
  const adpvValido = adpv >= ADPV_MIN_KG_DIA && adpv <= ADPV_MAX_KG_DIA;

  const acta = await leerArchivo(formData, 'acta_pdf');
  let actaUrl: string | null = null;
  let actaHash: string | null = null;
  if (acta) {
    actaUrl = await subirArchivo({
      bucket: 'documentos',
      path: `${codigo}/acta-vacunacion-${sanitizarNombre(acta.nombre)}`,
      file: acta.buffer,
      contentType: mimeDocumento(acta.nombre),
    });
    actaHash = sha256Hex(acta.buffer);
  }
  const csvUrl = await subirArchivo({
    bucket: 'planillas',
    path: `${codigo}/pesadas-mes4.csv`,
    file: Buffer.from(csvText, 'utf8'),
    contentType: 'text/csv',
  });
  const csvHash = sha256Hex(Buffer.from(csvText, 'utf8'));

  if (!adpvValido) {
    await admin.from('auditorias_veterinarias').insert({
      lote_id: lote.id,
      vet_wallet: vetWallet,
      vet_nombre: vetNombre,
      matricula,
      acta_url: actaUrl,
      acta_hash: actaHash,
      csv_mes4_url: csvUrl,
      csv_mes4_hash: csvHash,
      peso_promedio_mes4_kg: resumen.promedioKg,
      adpv_kg_dia: redondear(adpv),
      conciliacion_ok: true,
      adpv_valido: false,
      observaciones,
    });
    await admin
      .from('lotes')
      .update({ peso_actual_promedio_kg: resumen.promedioKg, adpv_kg_dia: redondear(adpv) })
      .eq('id', lote.id);
    volverConError(
      `ALERTA_BIOLOGICA_OBSERVADA: ADPV ${redondear(adpv)} kg/dia fuera del rango biologico 0.5-1.3. Desembolso frenado.`,
    );
  }

  const txHashEnviado = String(formData.get('tx_hash') ?? '').trim();
  let txHash: string;

  if (txHashEnviado) {
    if (process.env.STELLAR_MODE === 'real' && process.env.NEXT_PUBLIC_STELLAR_CONTRACT_ID) {
      try {
        await verificarTxOnChain({
          txHash: txHashEnviado,
          wallet: vetWallet,
          metodo: 'verify_sanitary_milestone',
          args: argsSanidad({
            codigoLote: codigo,
            vetWallet,
            pesoMes4Kg: resumen.promedioKg,
            adpvGramosDia: Math.round(adpv * 1000),
            actaHash: actaHash ?? '',
            csvMes4Hash: csvHash,
          }),
        });
      } catch (err) {
        volverConError(
          `Error verificando transacción on-chain: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    txHash = txHashEnviado;
  } else {
    const tx = await getStellarClient().verifySanitaryMilestone({
      codigoLote: codigo,
      vetWallet,
      midtermAvgWeightKg: resumen.promedioKg,
      adpvGramsPerDay: Math.round(adpv * 1000),
      vaccinationActaHash: actaHash ?? '',
      midtermRfidWeightsHash: csvHash,
    });
    txHash = tx.txHash;
  }

  if (user) {
    await admin.from('perfiles').update({ wallet: vetWallet }).eq('id', user.id);
  }

  await admin.from('auditorias_veterinarias').insert({
    lote_id: lote.id,
    vet_wallet: vetWallet,
    vet_nombre: vetNombre,
    matricula,
    acta_url: actaUrl,
    acta_hash: actaHash,
    csv_mes4_url: csvUrl,
    csv_mes4_hash: csvHash,
    peso_promedio_mes4_kg: resumen.promedioKg,
    adpv_kg_dia: redondear(adpv),
    conciliacion_ok: true,
    adpv_valido: true,
    observaciones,
    soroban_seal2_tx_hash: txHash,
  });

  await admin.from('caravanas').upsert(
    pesadas.rows.map((r) => ({ lote_id: lote.id, rfid: r.rfid, peso_mes4_kg: r.pesoKg })),
    { onConflict: 'lote_id,rfid' },
  );

  const desembolsos = calcularDesembolsos(Number(lote.monto_total_financiacion ?? 0));
  await admin.from('movimientos_escrow').insert({
    lote_id: lote.id,
    tipo: 'RELEASE_MILESTONE_2',
    monto: desembolsos.hito2,
    moneda: lote.moneda,
    tx_hash: txHash,
  });

  await admin
    .from('lotes')
    .update({
      seal_2_sanitary: true,
      peso_actual_promedio_kg: resumen.promedioKg,
      adpv_kg_dia: redondear(adpv),
      soroban_seal2_tx_hash: txHash,
    })
    .eq('id', lote.id);

  redirect(`/lotes/${codigo}`);
}

export async function despacharLoteAction(formData: FormData): Promise<void> {
  const codigo = String(formData.get('codigo') ?? '');
  const dteNro = String(formData.get('dte_nro') ?? '').trim();

  const admin = createAdminClient();
  const { data: lote } = await admin
    .from('lotes')
    .select('*')
    .eq('codigo_lote', codigo)
    .maybeSingle();
  if (!lote) redirect('/');

  const volverConError: (mensaje: string) => never = (mensaje) =>
    redirect(`/lotes/${codigo}?error=${encodeURIComponent(mensaje)}`);

  const user = await getCurrentUser();
  if (user && user.rol !== 'PRODUCTOR') {
    volverConError('El despacho DT-e requiere una cuenta con perfil de Productor.');
  }

  if (lote.estado_publicacion !== 'FINANCIADO_EN_ENGORDE' || !lote.seal_2_sanitary) {
    volverConError('El lote requiere el Sello 2 (auditoria del Mes 4) antes del despacho');
  }

  const dte = await leerArchivo(formData, 'dte_pdf');
  if (!dte) {
    volverConError('Subi el PDF del DT-e emitido en SENASA/SIGSA');
  }

  const dteUrl = await subirArchivo({
    bucket: 'documentos',
    path: `${codigo}/dte-${sanitizarNombre(dte.nombre)}`,
    file: dte.buffer,
    contentType: mimeDocumento(dte.nombre),
  });
  const dteHash = sha256Hex(dte.buffer);

  await admin.from('recepciones_frigorifico').insert({
    lote_id: lote.id,
    dte_nro: dteNro || `DTE-DEMO-${codigo}`,
    dte_url: dteUrl,
    dte_hash: dteHash,
  });

  await admin
    .from('lotes')
    .update({ estado_publicacion: 'EN_TRANSITO_A_FRIGORIFICO' })
    .eq('id', lote.id);

  redirect(`/lotes/${codigo}`);
}

export async function recepcionLoteAction(formData: FormData): Promise<void> {
  const codigo = String(formData.get('codigo') ?? '');
  const buyerWallet = String(formData.get('buyer_wallet') ?? '').trim();

  const admin = createAdminClient();
  const { data: lote } = await admin
    .from('lotes')
    .select('*')
    .eq('codigo_lote', codigo)
    .maybeSingle();
  if (!lote) redirect('/');

  const volverConError: (mensaje: string) => never = (mensaje) =>
    redirect(`/lotes/${codigo}?error=${encodeURIComponent(mensaje)}`);

  const user = await getCurrentUser();
  if (user && user.rol !== 'COMPRADOR') {
    volverConError('La recepción en balanza fiscal requiere una cuenta con perfil de Comprador.');
  }

  if (lote.estado_publicacion !== 'EN_TRANSITO_A_FRIGORIFICO') {
    volverConError('El lote no esta en transito a frigorifico');
  }

  const effectiveBuyerWallet = buyerWallet || String(lote.comprador_wallet ?? '');
  if (!effectiveBuyerWallet || !esWalletStellar(effectiveBuyerWallet)) {
    volverConError(
      'Conectá tu wallet Freighter en Stellar Testnet (G...) para confirmar la recepción',
    );
  }
  if (
    lote.productor_wallet &&
    effectiveBuyerWallet.toUpperCase() === String(lote.productor_wallet).toUpperCase()
  ) {
    volverConError('La wallet del comprador no puede ser la del productor (auto-compra bloqueada)');
  }

  const archivoCsv = formData.get('csv_recepcion');
  if (!(archivoCsv instanceof File) || archivoCsv.size === 0) {
    volverConError('Subi el CSV de la balanza fiscal de recepcion');
  }

  const csvText = await archivoCsv.text();
  const pesadas = parsePesadasCsv(csvText);
  if (pesadas.errors.length > 0 || pesadas.rows.length === 0) {
    volverConError(pesadas.errors.slice(0, 6).join(' | '));
  }

  const { data: caravanas } = await admin.from('caravanas').select('rfid').eq('lote_id', lote.id);
  const padron = (caravanas ?? []).map((c) => String(c.rfid));
  const conciliacion = conciliarCaravanas(
    padron,
    pesadas.rows.map((r) => r.rfid),
  );
  if (!conciliacion.ok) {
    volverConError(
      `Conciliacion final fallo. Faltantes: ${conciliacion.faltantes.join(', ') || 'ninguna'}. Ajenas: ${conciliacion.ajenas.join(', ') || 'ninguna'}`,
    );
  }

  const resumen = resumenPesadas(pesadas.rows);
  const montoTotal = Number(lote.monto_total_financiacion ?? 0);
  const tramoFinal = calcularDesembolsos(montoTotal).hito3;
  const liquidacion = calcularLiquidacionFinal({
    montoTotal,
    tramoFinal,
    pesoObjetivoKg: Number(lote.peso_objetivo_kg ?? 0),
    pesoFinalKg: resumen.promedioKg,
  });

  const csvUrl = await subirArchivo({
    bucket: 'planillas',
    path: `${codigo}/recepcion-balanza-fiscal.csv`,
    file: Buffer.from(csvText, 'utf8'),
    contentType: 'text/csv',
  });
  const csvHash = sha256Hex(Buffer.from(csvText, 'utf8'));

  const ticket = await leerArchivo(formData, 'ticket_pdf');
  let ticketUrl: string | null = null;
  if (ticket) {
    ticketUrl = await subirArchivo({
      bucket: 'documentos',
      path: `${codigo}/ticket-balanza-${sanitizarNombre(ticket.nombre)}`,
      file: ticket.buffer,
      contentType: mimeDocumento(ticket.nombre),
    });
  }

  const { data: recepcionPrevia } = await admin
    .from('recepciones_frigorifico')
    .select('id, dte_hash')
    .eq('lote_id', lote.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const txHashEnviado = String(formData.get('tx_hash') ?? '').trim();
  let txHash: string;

  if (txHashEnviado) {
    if (process.env.STELLAR_MODE === 'real' && process.env.NEXT_PUBLIC_STELLAR_CONTRACT_ID) {
      try {
        await verificarTxOnChain({
          txHash: txHashEnviado,
          wallet: effectiveBuyerWallet,
          metodo: 'complete_delivery_and_settle',
          args: argsCierre({
            codigoLote: codigo,
            compradorWallet: effectiveBuyerWallet,
            pesoFinalKg: resumen.promedioKg,
            dteHash: String(recepcionPrevia?.dte_hash ?? ''),
            recepcionHash: csvHash,
          }),
        });
      } catch (err) {
        volverConError(
          `Error verificando transacción on-chain: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    txHash = txHashEnviado;
  } else {
    const tx = await getStellarClient().completeDeliveryAndSettle({
      codigoLote: codigo,
      buyerWallet: effectiveBuyerWallet,
      finalAvgWeightKg: resumen.promedioKg,
      dtePdfHash: String(recepcionPrevia?.dte_hash ?? ''),
      receptionHash: csvHash,
      shortfallDeduction: liquidacion.deduccion,
    });
    txHash = tx.txHash;
  }

  if (user) {
    await admin.from('perfiles').update({ wallet: effectiveBuyerWallet }).eq('id', user.id);
  }

  const datosRecepcion = {
    cabezas_recibidas: resumen.cantidad,
    peso_final_promedio_kg: resumen.promedioKg,
    kilos_recibidos: redondear(resumen.promedioKg * resumen.cantidad),
    kilos_objetivo: redondear(Number(lote.peso_objetivo_kg ?? 0) * resumen.cantidad),
    ajuste_usdc: liquidacion.deduccion,
    conciliacion_ok: true,
    buyer_wallet: effectiveBuyerWallet,
    csv_recepcion_url: csvUrl,
    csv_recepcion_hash: csvHash,
    ticket_balanza_url: ticketUrl,
    soroban_seal3_tx_hash: txHash,
  };

  if (recepcionPrevia?.id) {
    await admin.from('recepciones_frigorifico').update(datosRecepcion).eq('id', recepcionPrevia.id);
  } else {
    await admin.from('recepciones_frigorifico').insert({ lote_id: lote.id, ...datosRecepcion });
  }

  await admin.from('caravanas').upsert(
    pesadas.rows.map((r) => ({ lote_id: lote.id, rfid: r.rfid, peso_final_kg: r.pesoKg })),
    { onConflict: 'lote_id,rfid' },
  );

  const moneda = String(lote.moneda ?? 'USDC');
  await admin.from('movimientos_escrow').insert({
    lote_id: lote.id,
    tipo: 'RELEASE_MILESTONE_3',
    monto: liquidacion.pagoProductor,
    moneda,
    tx_hash: txHash,
  });
  if (liquidacion.deduccion > 0) {
    await admin.from('movimientos_escrow').insert({
      lote_id: lote.id,
      tipo: 'REFUND_WEIGHT_SHORTFALL',
      monto: liquidacion.reembolsoComprador,
      moneda,
      tx_hash: txHash,
    });
  }

  await admin
    .from('lotes')
    .update({
      estado_publicacion: 'CERRADO_CICLO',
      seal_3_reception: true,
      peso_final_promedio_kg: resumen.promedioKg,
      soroban_seal3_tx_hash: txHash,
    })
    .eq('id', lote.id);

  redirect(`/lotes/${codigo}`);
}

export const registrarLoteAction = crearLoteAction;
export const auditoriaVeterinariaAction = registrarAuditoriaAction;
export const recepcionFrigorificoAction = recepcionLoteAction;

/**
 * Server action para la demo: fondea una cuenta de comprador con USDC en Testnet
 * utilizando la liquidez del admin.
 */
export async function solicitarUsdcDemoAction(
  destino: string,
  monto: number,
): Promise<{ ok: boolean; txHash?: string; error?: string }> {
  try {
    if (!esWalletStellar(destino)) {
      return { ok: false, error: 'Dirección Stellar inválida' };
    }
    const montoSeguro = Math.min(Math.max(monto, 1), 25000);
    const { txHash } = await transferirUsdcDemo(destino, montoSeguro);
    return { ok: true, txHash };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
