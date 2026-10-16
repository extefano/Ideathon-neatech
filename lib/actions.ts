'use server';

import { redirect } from 'next/navigation';
import { eudrGeoHash, rfidListHash, sha256Hex } from '@/lib/crypto';
import { parsePesadasCsv, resumenPesadas } from '@/lib/csv';
import { paso1Schema } from '@/lib/domain';
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
