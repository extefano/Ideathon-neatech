'use server';

import { redirect } from 'next/navigation';
import {
  canPerformStage,
  esDuenoDelLote,
  getCurrentUser,
  identidadProductor,
  type PerfilUsuario,
} from '@/lib/auth';
import { eudrGeoHash, rfidListHash, sha256Hex } from '@/lib/crypto';
import { parsePesadasCsv, resumenPesadas, conciliarCaravanas } from '@/lib/csv';
import {
  ADPV_MAX_KG_DIA,
  ADPV_MIN_KG_DIA,
  CODIGOS_CERTIFICACION_COMERCIAL,
  esCodigoCertificacionComercial,
  normalizarCertificacionesComerciales,
  obtenerDefinicionCertificacion,
  paso1Schema,
  type CertificacionComercialLote,
} from '@/lib/domain';
import { calcularDesembolsos, calcularLiquidacionFinal } from '@/lib/escrow';
import { consultarDeforestacion, hayDeforestacion } from '@/lib/gfw';
import { parseAndValidatePolygon } from '@/lib/geo';
import {
  TOKEN_SAC_TESTNET_USDC,
  getStellarClient,
  transferirUsdcDemo,
  verificarTxOnChain,
} from '@/lib/stellar';
import { argsFondeo, argsSanidad, argsCierre, esWalletStellar } from '@/lib/stellar-args';
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

async function intentarValidacionGfw(input: {
  loteId: string;
  codigoLote: string;
  poligono: unknown;
  productorWallet: string;
  renspaDocHash: string;
  rfidHash: string;
  headCount: number;
  initialAvgWeightKg: number;
  targetWeightKg: number;
  financingAmount: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.GFW_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'GFW_API_KEY no configurada en el entorno del servidor' };
  }

  const admin = createAdminClient();

  let gfw;
  try {
    gfw = await consultarDeforestacion({ geometry: input.poligono, apiKey });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'error desconocido';
    return { ok: false, error: `Global Forest Watch no respondió: ${msg}` };
  }

  const eudrHash = eudrGeoHash({ poligono: input.poligono, gfw, checkedAt: gfw.checkedAt });

  if (hayDeforestacion(gfw)) {
    const { error: updateError } = await admin
      .from('lotes')
      .update({ gfw_consulta: gfw, eudr_geo_hash: eudrHash, estado_publicacion: 'RECHAZADO_EUDR' })
      .eq('id', input.loteId);
    if (updateError) {
      return {
        ok: false,
        error: `No se pudo registrar la validación EUDR: ${updateError.message}`,
      };
    }
    return { ok: true };
  }

  const tx = await getStellarClient().createAndVerifyOrigin({
    codigoLote: input.codigoLote,
    producerWallet: input.productorWallet,
    renspaDocHash: input.renspaDocHash,
    rfidListHash: input.rfidHash,
    eudrGeoHash: eudrHash,
    headCount: input.headCount,
    initialAvgWeightKg: input.initialAvgWeightKg,
    targetWeightKg: input.targetWeightKg,
    financingAmount: input.financingAmount,
    tokenSacAddress: TOKEN_SAC_TESTNET_USDC,
  });

  const { error: updateError } = await admin
    .from('lotes')
    .update({
      gfw_consulta: gfw,
      eudr_geo_hash: eudrHash,
      seal_1_eudr: true,
      soroban_create_tx_hash: tx.txHash,
      estado_publicacion: 'DISPONIBLE',
    })
    .eq('id', input.loteId);
  if (updateError) {
    return { ok: false, error: `No se pudo anclar el Sello 1: ${updateError.message}` };
  }

  return { ok: true };
}

export async function crearLoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user: PerfilUsuario | null = await getCurrentUser();
  if (!user || !canPerformStage(user, 'PASO_1_CREAR_LOTE')) {
    return { errors: ['Esta acción requiere una cuenta con perfil de Productor.'] };
  }

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

  const admin = createAdminClient();

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

  const { nombre: productorNombre, cuit: productorCuit } = identidadProductor(user);
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

  if (user) {
    await admin.from('perfiles').update({ wallet: productorWallet }).eq('id', user.id);
  }

  const monto = data.montoTotalFinanciacion;
  const kilosTotales = resumen.promedioKg * resumen.cantidad;

  const { data: loteRow, error: insertError } = await admin
    .from('lotes')
    .insert({
      renspa: data.renspa,
      provincia: data.provincia,
      localidad: data.localidad,
      poligono_geojson: JSON.parse(data.poligono),
      superficie_ha: geo.superficieHa,
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
    })
    .select('id, codigo_lote')
    .single();

  if (insertError || !loteRow) {
    return { errors: [`No se pudo crear el lote: ${insertError?.message ?? 'error desconocido'}`] };
  }

  const codigo = String(loteRow.codigo_lote);

  const renspaPdf = await leerArchivo(formData, 'renspa_pdf');
  let renspaDocUrl: string | null = null;
  let renspaDocHash: string | null = null;
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
  let boletoUrl: string | null = null;
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

  const rfidHash = rfidListHash(pesadas.rows);
  const certificacionesComerciales: CertificacionComercialLote[] = [];

  for (const codigoCert of CODIGOS_CERTIFICACION_COMERCIAL) {
    const activa = formData.get(`cert_activa_${codigoCert}`);
    if (!activa) continue;

    const def = obtenerDefinicionCertificacion(codigoCert);
    const emisor =
      String(formData.get(`cert_emisor_${codigoCert}`) ?? '').trim() || def.emisorDefault;
    const fechaEmision =
      String(formData.get(`cert_fecha_${codigoCert}`) ?? '').trim() ||
      new Date().toISOString().slice(0, 10);
    const observaciones =
      String(formData.get(`cert_observaciones_${codigoCert}`) ?? '').trim() ||
      def.observacionesDefault;
    const usarDemo = formData.get(`cert_usar_demo_${codigoCert}`) === 'true';
    const pdfCert = await leerArchivo(formData, `cert_pdf_${codigoCert}`);

    let docUrl: string | null = null;
    let docHash: string | null = null;

    if (pdfCert) {
      docUrl = await subirArchivo({
        bucket: 'documentos',
        path: `${codigo}/cert-${codigoCert.toLowerCase()}-${sanitizarNombre(pdfCert.nombre)}`,
        file: pdfCert.buffer,
        contentType: mimeDocumento(pdfCert.nombre),
      });
      docHash = sha256Hex(pdfCert.buffer);
    } else if (usarDemo) {
      docUrl = def.demoPdfUrl;
      docHash = def.demoPdfHash;
    }

    certificacionesComerciales.push({
      codigo: codigoCert,
      nombre: def.nombre,
      norma: def.norma,
      emisor,
      fecha_emision: fechaEmision,
      observaciones,
      doc_url: docUrl,
      doc_hash: docHash,
    });
  }

  await admin
    .from('lotes')
    .update({
      renspa_doc_url: renspaDocUrl,
      renspa_doc_hash: renspaDocHash,
      boleto_marca_url: boletoUrl,
      rfid_list_hash: rfidHash,
      certificaciones_comerciales: certificacionesComerciales,
    })
    .eq('id', loteRow.id);

  await admin.from('caravanas').insert(
    pesadas.rows.map((r) => ({
      lote_id: loteRow.id,
      rfid: r.rfid,
      peso_inicial_kg: r.pesoKg,
    })),
  );

  const resultado = await intentarValidacionGfw({
    loteId: String(loteRow.id),
    codigoLote: codigo,
    poligono: JSON.parse(data.poligono),
    productorWallet,
    renspaDocHash: renspaDocHash ?? '',
    rfidHash,
    headCount: resumen.cantidad,
    initialAvgWeightKg: resumen.promedioKg,
    targetWeightKg: data.pesoObjetivoKg,
    financingAmount: monto,
  });

  if (!resultado.ok) {
    return {
      errors: [
        `El lote ${codigo} se guardó y quedó PENDIENTE_VALIDACION. ${resultado.error}. Reintentá desde la ficha del lote.`,
      ],
    };
  }

  redirect(`/lotes/${codigo}`);
}

export async function reintentarGfwAction(formData: FormData): Promise<void> {
  const codigo = String(formData.get('codigo') ?? '');
  if (!codigo) redirect('/');

  const user: PerfilUsuario | null = await getCurrentUser();
  if (!user || !canPerformStage(user, 'PASO_1_CREAR_LOTE')) {
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

  if (!esDuenoDelLote(user, lote)) {
    redirect(
      `/lotes/${codigo}?error=${encodeURIComponent(
        'Solo el productor dueño del lote puede reintentar la validación EUDR.',
      )}`,
    );
  }

  const resultado = await intentarValidacionGfw({
    loteId: String(lote.id),
    codigoLote: codigo,
    poligono: lote.poligono_geojson,
    productorWallet: String(lote.productor_wallet ?? ''),
    renspaDocHash: String(lote.renspa_doc_hash ?? ''),
    rfidHash: String(lote.rfid_list_hash ?? ''),
    headCount: Number(lote.cantidad_cabezas ?? 0),
    initialAvgWeightKg: Number(lote.peso_promedio_kg ?? 0),
    targetWeightKg: Number(lote.peso_objetivo_kg ?? 0),
    financingAmount: Number(lote.monto_total_financiacion ?? 0),
  });

  if (!resultado.ok) {
    redirect(`/lotes/${codigo}?gfw=error&msg=${encodeURIComponent(resultado.error)}`);
  }

  redirect(`/lotes/${codigo}`);
}

export async function fondearLoteAction(formData: FormData): Promise<void> {
  const codigo = String(formData.get('codigo') ?? '');
  if (!codigo) redirect('/');

  const user: PerfilUsuario | null = await getCurrentUser();
  if (!user || !canPerformStage(user, 'PASO_2_FONDEAR_ESCROW')) {
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

  const user: PerfilUsuario | null = await getCurrentUser();
  if (!user || !canPerformStage(user, 'PASO_3_AUDITORIA_VET')) {
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

  const user: PerfilUsuario | null = await getCurrentUser();
  if (!user || !canPerformStage(user, 'PASO_4A_DESPACHO')) {
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

  const user: PerfilUsuario | null = await getCurrentUser();
  if (!user || !canPerformStage(user, 'PASO_4B_RECEPCION')) {
    volverConError(
      'La recepción en balanza fiscal requiere una cuenta con perfil de Comprador o Frigorífico.',
    );
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

  if (user && user.rol !== 'FRIGORIFICO') {
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

export async function registrarCertificacionComercialAction(formData: FormData): Promise<void> {
  const codigo = String(formData.get('codigo') ?? '').trim();
  if (!codigo) redirect('/');

  const volverConError: (mensaje: string) => never = (mensaje) =>
    redirect(`/lotes/${codigo}?error=${encodeURIComponent(mensaje)}`);

  const user = await getCurrentUser();
  if (user && user.rol !== 'PRODUCTOR' && user.rol !== 'VETERINARIO') {
    volverConError(
      'La carga de certificaciones voluntarias requiere una cuenta de Productor o Veterinario acreditado.',
    );
  }

  const codigoCertRaw = String(formData.get('codigo_certificacion') ?? '').trim();
  if (!esCodigoCertificacionComercial(codigoCertRaw)) {
    volverConError('Seleccioná una certificación comercial válida del catálogo.');
  }

  const admin = createAdminClient();
  const { data: lote } = await admin
    .from('lotes')
    .select('id, codigo_lote, certificaciones_comerciales')
    .eq('codigo_lote', codigo)
    .maybeSingle();
  if (!lote) redirect('/');

  const def = obtenerDefinicionCertificacion(codigoCertRaw);
  const actuales = normalizarCertificacionesComerciales(lote.certificaciones_comerciales);
  const previa = actuales.find((c) => c.codigo === codigoCertRaw);

  const emisor = String(formData.get('emisor') ?? '').trim() || previa?.emisor || def.emisorDefault;
  const fechaEmision =
    String(formData.get('fecha_emision') ?? '').trim() ||
    previa?.fecha_emision ||
    new Date().toISOString().slice(0, 10);
  const observaciones =
    String(formData.get('observaciones') ?? '').trim() ||
    previa?.observaciones ||
    def.observacionesDefault;
  const usarDemo = formData.get('usar_demo_pdf') === 'true';
  const archivoPdf = await leerArchivo(formData, 'cert_pdf');

  let docUrl: string | null = previa?.doc_url ?? null;
  let docHash: string | null = previa?.doc_hash ?? null;

  if (archivoPdf) {
    docUrl = await subirArchivo({
      bucket: 'documentos',
      path: `${codigo}/cert-${codigoCertRaw.toLowerCase()}-${sanitizarNombre(archivoPdf.nombre)}`,
      file: archivoPdf.buffer,
      contentType: mimeDocumento(archivoPdf.nombre),
    });
    docHash = sha256Hex(archivoPdf.buffer);
  } else if (usarDemo) {
    docUrl = def.demoPdfUrl;
    docHash = def.demoPdfHash;
  }

  const nuevaCert: CertificacionComercialLote = {
    codigo: codigoCertRaw,
    nombre: def.nombre,
    norma: def.norma,
    emisor,
    fecha_emision: fechaEmision,
    observaciones,
    doc_url: docUrl,
    doc_hash: docHash,
  };

  const actualizadas = [...actuales.filter((c) => c.codigo !== codigoCertRaw), nuevaCert];

  const { error } = await admin
    .from('lotes')
    .update({ certificaciones_comerciales: actualizadas })
    .eq('id', lote.id);

  if (error) {
    volverConError(`No se pudo guardar la certificación: ${error.message}`);
  }

  redirect(`/lotes/${codigo}`);
}
