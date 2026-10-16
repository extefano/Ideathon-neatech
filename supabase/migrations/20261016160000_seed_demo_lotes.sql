-- Seed de demo (Ticket #15): lotes en distintas etapas para el recorrido comercial.
-- Idempotente: si los codigos ya existen, no hace nada.

do $$
declare
  v_lote_id uuid;
  v_i integer;
  v_rfid text;
  v_peso numeric;
begin
  -- Lote DISPONIBLE en el marketplace (Santa Fe, novillitos)
  if not exists (select 1 from public.lotes where codigo_lote = 'LOTE-00107') then
    insert into public.lotes (
      codigo_lote, titulo, productor_wallet, renspa, provincia, localidad,
      poligono_geojson, superficie_ha, cantidad_cabezas, peso_promedio_kg,
      peso_min_kg, peso_max_kg, uniformidad, rfid_list_hash,
      tipo_operacion, categoria, raza, tipo_rodeo,
      moneda, monto_total_financiacion, peso_objetivo_kg, plazo_meses, fecha_vigencia,
      precio_por_cabeza, precio_por_kg, descripcion_operacion,
      estado_publicacion, seal_1_eudr, gfw_consulta, eudr_geo_hash, renspa_doc_hash,
      soroban_create_tx_hash
    ) values (
      'LOTE-00107', '40 Novillitos Hereford - 240 kg', 'GDEMO-PRODUCTOR-2',
      '12.345.6.00789/01', 'Santa Fe', 'Venado Tuerto',
      '{"type":"Polygon","coordinates":[[[-61.9,-33.7],[-61.84,-33.7],[-61.84,-33.65],[-61.9,-33.65],[-61.9,-33.7]]]}'::jsonb,
      3236.31, 40, 240, 231, 249, 'Parejo',
      'c0ffee0000000000000000000000000000000000000000000000000000000001',
      'Invernada / Engorde', 'Novillitos', 'Hereford', 'Rodeo general',
      'USDC', 14000, 420, 6, '2026-12-15', 350, 1.46,
      'Tropa de novillitos Hereford a pastura, objetivo 420 kg en 6 meses.',
      'DISPONIBLE', true,
      '{"totalLossHa":0,"byYear":[],"checkedAt":"2026-10-16T05:00:00.000Z","criterio":"umd_tree_cover_loss >= 2021 (corte reglamentario EUDR: 31/12/2020)"}'::jsonb,
      'a11ce00000000000000000000000000000000000000000000000000000000001',
      'b0bb1e0000000000000000000000000000000000000000000000000000000001',
      'd34db33f00000000000000000000000000000000000000000000000000000001'
    ) returning id into v_lote_id;

    for v_i in 1..40 loop
      v_rfid := '032' || lpad((100 + v_i)::text, 12, '0');
      v_peso := 231 + (v_i % 19);
      insert into public.caravanas (lote_id, rfid, peso_inicial_kg) values (v_lote_id, v_rfid, v_peso);
    end loop;
  end if;

  -- Lote DISPONIBLE en Corrientes (vacas CUT)
  if not exists (select 1 from public.lotes where codigo_lote = 'LOTE-00108') then
    insert into public.lotes (
      codigo_lote, titulo, productor_wallet, renspa, provincia, localidad,
      poligono_geojson, superficie_ha, cantidad_cabezas, peso_promedio_kg,
      peso_min_kg, peso_max_kg, uniformidad, rfid_list_hash,
      tipo_operacion, categoria, raza, tipo_rodeo,
      moneda, monto_total_financiacion, peso_objetivo_kg, plazo_meses, fecha_vigencia,
      precio_por_cabeza, precio_por_kg, descripcion_operacion,
      estado_publicacion, seal_1_eudr, gfw_consulta, eudr_geo_hash, renspa_doc_hash,
      soroban_create_tx_hash
    ) values (
      'LOTE-00108', '25 Vacas Braford CUT - 380 kg', 'GDEMO-PRODUCTOR-3',
      '05.077.0.00999/02', 'Corrientes', 'Mercedes',
      '{"type":"Polygon","coordinates":[[[-58.1,-29.5],[-58.04,-29.5],[-58.04,-29.45],[-58.1,-29.45],[-58.1,-29.5]]]}'::jsonb,
      3236.31, 25, 380, 361, 398, 'Bastante parejo',
      'c0ffee0000000000000000000000000000000000000000000000000000000002',
      'Faena', 'Vacas', 'Braford', 'Rodeo general',
      'USDC', 9500, 380, 3, '2026-11-30', 380, 1.0,
      'Vacas CUT (cría último ternero) para faena inmediata en frigorífico exportador.',
      'DISPONIBLE', true,
      '{"totalLossHa":0,"byYear":[],"checkedAt":"2026-10-16T05:00:00.000Z","criterio":"umd_tree_cover_loss >= 2021 (corte reglamentario EUDR: 31/12/2020)"}'::jsonb,
      'a11ce00000000000000000000000000000000000000000000000000000000002',
      'b0bb1e0000000000000000000000000000000000000000000000000000000002',
      'd34db33f00000000000000000000000000000000000000000000000000000002'
    ) returning id into v_lote_id;

    for v_i in 1..25 loop
      v_rfid := '032' || lpad((200 + v_i)::text, 12, '0');
      v_peso := 361 + (v_i % 37);
      insert into public.caravanas (lote_id, rfid, peso_inicial_kg) values (v_lote_id, v_rfid, v_peso);
    end loop;
  end if;

  -- Lote FINANCIADO en engorde (Buenos Aires, terneros)
  if not exists (select 1 from public.lotes where codigo_lote = 'LOTE-00109') then
    insert into public.lotes (
      codigo_lote, titulo, productor_wallet, renspa, provincia, localidad,
      poligono_geojson, superficie_ha, cantidad_cabezas, peso_promedio_kg,
      peso_min_kg, peso_max_kg, uniformidad, rfid_list_hash,
      tipo_operacion, categoria, raza, tipo_rodeo,
      moneda, monto_total_financiacion, peso_objetivo_kg, plazo_meses, fecha_vigencia,
      precio_por_cabeza, precio_por_kg, descripcion_operacion,
      estado_publicacion, seal_1_eudr, gfw_consulta, eudr_geo_hash, renspa_doc_hash,
      soroban_create_tx_hash, comprador_wallet, funded_at, soroban_fund_tx_hash
    ) values (
      'LOTE-00109', '50 Terneros Angus - 210 kg', 'GDEMO-PRODUCTOR-4',
      '01.234.5.00666/03', 'Buenos Aires', 'Azul',
      '{"type":"Polygon","coordinates":[[[-59.5,-36.9],[-59.44,-36.9],[-59.44,-36.85],[-59.5,-36.85],[-59.5,-36.9]]]}'::jsonb,
      3236.31, 50, 210, 202, 219, 'Parejo',
      'c0ffee0000000000000000000000000000000000000000000000000000000003',
      'Recría', 'Terneros', 'Aberdeen Angus negro', 'Rodeo general',
      'USDC', 18000, 400, 10, '2026-12-20', 360, 1.71,
      'Cincuenta terneros Angus para recría a campo natural con verdeo de invierno.',
      'FINANCIADO_EN_ENGORDE', true,
      '{"totalLossHa":0,"byYear":[],"checkedAt":"2026-10-16T05:00:00.000Z","criterio":"umd_tree_cover_loss >= 2021 (corte reglamentario EUDR: 31/12/2020)"}'::jsonb,
      'a11ce00000000000000000000000000000000000000000000000000000000003',
      'b0bb1e0000000000000000000000000000000000000000000000000000000003',
      'd34db33f00000000000000000000000000000000000000000000000000000003',
      'GDEMO-FRIGORIFICO', now(), 'e55c0de0000000000000000000000000000000000000000000000000000000'
    ) returning id into v_lote_id;

    for v_i in 1..50 loop
      v_rfid := '032' || lpad((300 + v_i)::text, 12, '0');
      v_peso := 202 + (v_i % 17);
      insert into public.caravanas (lote_id, rfid, peso_inicial_kg) values (v_lote_id, v_rfid, v_peso);
    end loop;

    insert into public.movimientos_escrow (lote_id, tipo, monto, moneda, tx_hash) values
      (v_lote_id, 'DEPOSIT_ESCROW', 18000, 'USDC', 'e55c0de0000000000000000000000000000000000000000000000000000000'),
      (v_lote_id, 'RELEASE_MILESTONE_1', 7200, 'USDC', 'e55c0de0000000000000000000000000000000000000000000000000000000');
  end if;
end;
$$;
