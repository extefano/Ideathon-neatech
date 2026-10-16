'use server';

import { redirect } from 'next/navigation';
import { eudrGeoHash, rfidListHash, sha256Hex } from '@/lib/crypto';
import { parsePesadasCsv, resumenPesadas, conciliarCaravanas } from '@/lib/csv';
import { ADPV_MAX_KG_DIA, ADPV_MIN_KG_DIA, paso1Schema } from '@/lib/domain';
import { calcularDesembolsos, calcularLiquidacionFinal } from '@/lib/escrow';
import { consultarDeforestacion, hayDeforestacion } from '@/lib/gfw';
import { parseAndValidatePolygon } from '@/lib/geo';
import { TOKEN_SAC_TESTNET_USDC, getStellarClient } from '@/lib/stellar';
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
    await admin
      .from('lotes')
      .update({ gfw_consulta: gfw, eudr_geo_hash: eudrHash, estado_publicacion: 'RECHAZADO_EUDR' })
      .eq('id', input.loteId);
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

  await admin
    .from('lotes')
    .update({
      gfw_consulta: gfw,
      eudr_geo_hash: eudrHash,
      seal_1_eudr: true,
      soroban_create_tx_hash: tx.txHash,
      estado_publicacion: 'DISPONIBLE',
    })
    .eq('id', input.loteId);

  return { ok: true };
}

export async function crearLoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
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

  const productorNombre = String(formData.get('productor_nombre') ?? '').trim();
  const productorCuit = String(formData.get('productor_cuit') ?? '').trim();
  const productorWallet =
    String(formData.get('productor_wallet') ?? '').trim() || 'GDEMO-PRODUCTOR';

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

  await admin
    .from('lotes')
    .update({
      renspa_doc_url: renspaDocUrl,
      renspa_doc_hash: renspaDocHash,
      boleto_marca_url: boletoUrl,
      rfid_list_hash: rfidHash,
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

  const admin = createAdminClient();
  const { data: lote } = await admin
    .from('lotes')
    .select('*')
    .eq('codigo_lote', codigo)
    .maybeSingle();
  if (!lote) redirect('/');

  const resultado = await intentarValidacionGfw({
    loteId: String(lote.id),
    codigoLote: codigo,
    poligono: lote.poligono_geojson,
    productorWallet: String(lote.productor_wallet ?? 'GDEMO-PRODUCTOR'),
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
  if (!buyerWallet) {
    volverConError('Ingresa la wallet del comprador');
  }
  if (buyerWallet === lote.productor_wallet) {
    volverConError('La wallet del comprador no puede ser la del productor (auto-compra bloqueada)');
  }

  const monto = Number(lote.monto_total_financiacion ?? 0);
  const desembolsos = calcularDesembolsos(monto);

  const tx = await getStellarClient().fundLotEscrow({
    codigoLote: codigo,
    buyerWallet,
    amount: monto,
  });

  await admin.from('compradores').upsert(
    {
      wallet: buyerWallet,
      razon_social: buyerNombre,
      cuit: '30-00000000-0',
      tipo_comprador: 'FRIGORIFICO_EXPORTADOR',
    },
    { onConflict: 'wallet' },
  );

  await admin.from('movimientos_escrow').insert([
    {
      lote_id: lote.id,
      tipo: 'DEPOSIT_ESCROW',
      monto,
      moneda: lote.moneda,
      tx_hash: tx.txHash,
    },
    {
      lote_id: lote.id,
      tipo: 'RELEASE_MILESTONE_1',
      monto: desembolsos.hito1,
      moneda: lote.moneda,
      tx_hash: tx.txHash,
    },
  ]);

  await admin
    .from('lotes')
    .update({
      estado_publicacion: 'FINANCIADO_EN_ENGORDE',
      comprador_wallet: buyerWallet,
      funded_at: new Date().toISOString(),
      soroban_fund_tx_hash: tx.txHash,
    })
    .eq('id', lote.id);

  redirect(`/lotes/${codigo}`);
}

export async function registrarAuditoriaAction(formData: FormData): Promise<void> {
  const codigo = String(formData.get('codigo') ?? '');
  const vetNombre = String(formData.get('vet_nombre') ?? '').trim();
  const matricula = String(formData.get('matricula') ?? '').trim();
  const vetWallet = String(formData.get('vet_wallet') ?? '').trim() || 'GDEMO-VETERINARIO';
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

  const tx = await getStellarClient().verifySanitaryMilestone({
    codigoLote: codigo,
    vetWallet,
    midtermAvgWeightKg: resumen.promedioKg,
    adpvGramsPerDay: Math.round(adpv * 1000),
    vaccinationActaHash: actaHash ?? '',
    midtermRfidWeightsHash: csvHash,
  });

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
    soroban_seal2_tx_hash: tx.txHash,
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
    tx_hash: tx.txHash,
  });

  await admin
    .from('lotes')
    .update({
      seal_2_sanitary: true,
      peso_actual_promedio_kg: resumen.promedioKg,
      adpv_kg_dia: redondear(adpv),
      soroban_seal2_tx_hash: tx.txHash,
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

  if (lote.estado_publicacion !== 'EN_TRANSITO_A_FRIGORIFICO') {
    volverConError('El lote no esta en transito a frigorifico');
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

  const tx = await getStellarClient().completeDeliveryAndSettle({
    codigoLote: codigo,
    buyerWallet: buyerWallet || String(lote.comprador_wallet ?? 'GDEMO-FRIGORIFICO'),
    finalAvgWeightKg: resumen.promedioKg,
    dtePdfHash: String(recepcionPrevia?.dte_hash ?? ''),
    receptionHash: csvHash,
    shortfallDeduction: liquidacion.deduccion,
  });

  const datosRecepcion = {
    cabezas_recibidas: resumen.cantidad,
    peso_final_promedio_kg: resumen.promedioKg,
    kilos_recibidos: redondear(resumen.promedioKg * resumen.cantidad),
    kilos_objetivo: redondear(Number(lote.peso_objetivo_kg ?? 0) * resumen.cantidad),
    ajuste_usdc: liquidacion.deduccion,
    conciliacion_ok: true,
    buyer_wallet: buyerWallet || String(lote.comprador_wallet ?? 'GDEMO-FRIGORIFICO'),
    csv_recepcion_url: csvUrl,
    csv_recepcion_hash: csvHash,
    ticket_balanza_url: ticketUrl,
    soroban_seal3_tx_hash: tx.txHash,
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
    tx_hash: tx.txHash,
  });
  if (liquidacion.deduccion > 0) {
    await admin.from('movimientos_escrow').insert({
      lote_id: lote.id,
      tipo: 'REFUND_WEIGHT_SHORTFALL',
      monto: liquidacion.reembolsoComprador,
      moneda,
      tx_hash: tx.txHash,
    });
  }

  await admin
    .from('lotes')
    .update({
      estado_publicacion: 'CERRADO_CICLO',
      seal_3_reception: true,
      peso_final_promedio_kg: resumen.promedioKg,
      soroban_seal3_tx_hash: tx.txHash,
    })
    .eq('id', lote.id);

  redirect(`/lotes/${codigo}`);
}
