import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SECRET_KEY. Corré: node --env-file=.env.local scripts/verificar-inmutabilidad-lotes.mjs',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const POLIGONO_A = {
  type: 'Polygon',
  coordinates: [
    [
      [-58, -31],
      [-58, -31.05],
      [-57.95, -31.05],
      [-57.95, -31],
      [-58, -31],
    ],
  ],
};

const POLIGONO_B = {
  type: 'Polygon',
  coordinates: [
    [
      [-59, -32],
      [-59, -32.05],
      [-58.95, -32.05],
      [-58.95, -32],
      [-59, -32],
    ],
  ],
};

const resultados = [];
let fallos = 0;

function registrar(nombre, ok, detalle) {
  resultados.push({ nombre, ok, detalle });
  if (!ok) fallos += 1;
  console.info(`${ok ? 'PASS' : 'FAIL'} — ${nombre}: ${detalle}`);
}

function iguales(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((valor, i) => iguales(valor, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const clavesA = Object.keys(a).sort();
    const clavesB = Object.keys(b).sort();
    return (
      clavesA.length === clavesB.length &&
      clavesA.every((clave, i) => clave === clavesB[i] && iguales(a[clave], b[clave]))
    );
  }
  return false;
}

function contieneSello1(error) {
  const texto = `${error?.message ?? ''} ${error?.details ?? ''}`;
  return texto.includes('Sello 1') || texto.includes('inmutable');
}

const renspa = `TEST-INMUT-${Date.now()}`;
let loteId = null;
let codigoLote = null;

try {
  const { error: insertError } = await supabase.from('lotes').insert({
    renspa,
    titulo: 'Prueba de inmutabilidad (temporal)',
    poligono_geojson: POLIGONO_A,
    superficie_ha: 12.5,
    cantidad_cabezas: 10,
    peso_promedio_kg: 220,
    monto_total_financiacion: 1500,
  });

  if (insertError) {
    registrar('1. Insertar lote de prueba', false, `error: ${insertError.message}`);
  } else {
    const { data: fila, error: readError } = await supabase
      .from('lotes')
      .select('id, codigo_lote, estado_publicacion')
      .eq('renspa', renspa)
      .single();

    if (readError || !fila) {
      registrar(
        '1. Insertar lote de prueba',
        false,
        `insert ok pero no se pudo releer la fila: ${readError?.message ?? 'sin datos'}`,
      );
    } else {
      loteId = fila.id;
      codigoLote = fila.codigo_lote;
      registrar(
        '1. Insertar lote de prueba',
        fila.estado_publicacion === 'PENDIENTE_VALIDACION',
        `lote ${fila.codigo_lote} (${fila.id}), estado inicial ${fila.estado_publicacion}`,
      );
    }
  }

  if (loteId) {
    const { error: updatePreSelloError } = await supabase
      .from('lotes')
      .update({ poligono_geojson: POLIGONO_B })
      .eq('id', loteId);

    if (updatePreSelloError) {
      registrar(
        '2. Update pre-sello cambia polígono',
        false,
        `el update debía ser legal pero falló: ${updatePreSelloError.message}`,
      );
    } else {
      const { data: fila, error: readError } = await supabase
        .from('lotes')
        .select('poligono_geojson, gfw_consulta, eudr_geo_hash, estado_publicacion')
        .eq('id', loteId)
        .single();

      const poligonoOk = !readError && iguales(fila?.poligono_geojson, POLIGONO_B);
      const limpiezaOk = !readError && fila?.gfw_consulta === null && fila?.eudr_geo_hash === null;
      const estadoOk = !readError && fila?.estado_publicacion === 'PENDIENTE_VALIDACION';

      registrar(
        '2. Update pre-sello cambia polígono',
        poligonoOk && limpiezaOk && estadoOk,
        readError
          ? `error al releer: ${readError.message}`
          : `polígono ${poligonoOk ? 'actualizado' : 'NO actualizado'}, gfw_consulta=${JSON.stringify(
              fila.gfw_consulta,
            )}, eudr_geo_hash=${JSON.stringify(fila.eudr_geo_hash)}, estado=${fila.estado_publicacion}`,
      );
    }

    const { error: sellarError } = await supabase
      .from('lotes')
      .update({ seal_1_eudr: true, gfw_consulta: { test: true }, eudr_geo_hash: 'hash-test' })
      .eq('id', loteId);

    if (sellarError) {
      registrar('3. Sellar lote (seal_1_eudr)', false, `error: ${sellarError.message}`);
    } else {
      const { data: fila, error: readError } = await supabase
        .from('lotes')
        .select('seal_1_eudr, gfw_consulta, eudr_geo_hash')
        .eq('id', loteId)
        .single();

      const selloOk = !readError && fila?.seal_1_eudr === true;
      const evidenciaOk =
        !readError &&
        iguales(fila?.gfw_consulta, { test: true }) &&
        fila?.eudr_geo_hash === 'hash-test';

      registrar(
        '3. Sellar lote (seal_1_eudr)',
        selloOk && evidenciaOk,
        readError
          ? `error al releer: ${readError.message}`
          : `seal_1_eudr=${fila.seal_1_eudr}, gfw_consulta=${JSON.stringify(fila.gfw_consulta)}, eudr_geo_hash=${JSON.stringify(fila.eudr_geo_hash)}`,
      );
    }

    const { error: poligonoSelladoError } = await supabase
      .from('lotes')
      .update({ poligono_geojson: POLIGONO_A })
      .eq('id', loteId);

    registrar(
      '4. Update sellado cambia polígono (debe fallar)',
      Boolean(poligonoSelladoError) && contieneSello1(poligonoSelladoError),
      poligonoSelladoError
        ? `bloqueado con: ${poligonoSelladoError.message}`
        : 'ERROR: el update de polígono sellado fue PERMITIDO',
    );

    const { error: cabezasError } = await supabase
      .from('lotes')
      .update({ cantidad_cabezas: 99 })
      .eq('id', loteId);

    registrar(
      '4b. Update sellado cambia cantidad_cabezas (debe fallar)',
      Boolean(cabezasError) && contieneSello1(cabezasError),
      cabezasError
        ? `bloqueado con: ${cabezasError.message}`
        : 'ERROR: cambiar cantidad_cabezas sellada fue PERMITIDO',
    );

    const { error: montoError } = await supabase
      .from('lotes')
      .update({ monto_total_financiacion: 999999 })
      .eq('id', loteId);

    registrar(
      '4c. Update sellado cambia monto_total_financiacion (debe fallar)',
      Boolean(montoError) && contieneSello1(montoError),
      montoError
        ? `bloqueado con: ${montoError.message}`
        : 'ERROR: cambiar monto_total_financiacion sellado fue PERMITIDO',
    );

    const { error: destildarSelloError } = await supabase
      .from('lotes')
      .update({ seal_1_eudr: false })
      .eq('id', loteId);

    registrar(
      '5. Update sellado destilda seal_1_eudr (debe fallar)',
      Boolean(destildarSelloError) && contieneSello1(destildarSelloError),
      destildarSelloError
        ? `bloqueado con: ${destildarSelloError.message}`
        : 'ERROR: destildar seal_1_eudr fue PERMITIDO',
    );

    const { error: estadoError } = await supabase
      .from('lotes')
      .update({ estado_publicacion: 'RECHAZADO_EUDR' })
      .eq('id', loteId);

    if (estadoError) {
      registrar(
        '6. Update legal de estado_publicacion (no protegido)',
        false,
        `el update debía ser legal pero falló: ${estadoError.message}`,
      );
    } else {
      const { data: fila, error: readError } = await supabase
        .from('lotes')
        .select('estado_publicacion')
        .eq('id', loteId)
        .single();

      registrar(
        '6. Update legal de estado_publicacion (no protegido)',
        !readError && fila?.estado_publicacion === 'RECHAZADO_EUDR',
        readError
          ? `error al releer: ${readError.message}`
          : `estado_publicacion=${fila.estado_publicacion}`,
      );
    }

    const { error: deleteError } = await supabase.from('lotes').delete().eq('id', loteId);

    if (deleteError) {
      registrar('7. Borrar lote de prueba', false, `error: ${deleteError.message}`);
    } else {
      const { count, error: countError } = await supabase
        .from('lotes')
        .select('id', { count: 'exact', head: true })
        .eq('id', loteId);

      registrar(
        '7. Borrar lote de prueba',
        !countError && count === 0,
        countError ? `error al verificar: ${countError.message}` : `filas restantes: ${count}`,
      );
    }
  }
} catch (error) {
  registrar('Ejecución del script', false, `excepción inesperada: ${error?.message ?? error}`);
} finally {
  const { error: cleanupError } = await supabase.from('lotes').delete().eq('renspa', renspa);
  if (cleanupError) {
    registrar(
      'Limpieza final',
      false,
      `no se pudo borrar el lote ${renspa}: ${cleanupError.message}`,
    );
  } else {
    registrar('Limpieza final', true, `sin restos del lote de prueba ${renspa}`);
  }
}

console.info('');
console.info(
  `Resumen: ${resultados.length - fallos} PASS / ${fallos} FAIL (${resultados.length} verificaciones)`,
);
if (codigoLote) {
  console.info(`Lote usado en la prueba: ${codigoLote} (${renspa})`);
}

if (fallos > 0) {
  process.exitCode = 1;
}
