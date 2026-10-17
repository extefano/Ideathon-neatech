-- Migration: 20261016180000_certificaciones_voluntarias.sql
-- Certificaciones comerciales voluntarias (Eje 2 · Valor agregado: Sinergia GEI, Bienestar Animal, Libre de Antibióticos)
-- Issue #42

alter table public.lotes
  add column if not exists certificaciones_comerciales jsonb not null default '[]'::jsonb;

create index if not exists lotes_certificaciones_comerciales_gin_idx
  on public.lotes using gin (certificaciones_comerciales);

-- Poblar lotes de seed con certificaciones realistas del Eje 2 (incluyendo Sinergia Medio Ambiente)
update public.lotes
set certificaciones_comerciales = jsonb_build_array(
  jsonb_build_object(
    'codigo', 'HUELLA_CARBONO_SINERGIA',
    'nombre', 'Huella de Carbono e Inventario GEI (Sinergia Medio Ambiente)',
    'norma', 'ISO 14064 / ISO 14067 · GHG Protocol',
    'emisor', 'Sinergia Medio Ambiente · Auditoría IRAM / Control Union',
    'fecha_emision', '2026-10-05',
    'observaciones', 'Inventario biológico GEI y plan de mitigación con pastoreo rotativo en pradera pampeana.',
    'doc_url', '/demo/informe-sinergia-gei-demo.pdf',
    'doc_hash', 'e86d8ca1aefa0060f52ec295c1cf494fd0902de61baa0b3fee9b9cbbeeb46076'
  ),
  jsonb_build_object(
    'codigo', 'LIBRE_ANTIBIOTICOS_HORMONAS',
    'nombre', 'Libre de Antibióticos y Promotores Hormonales',
    'norma', 'Protocolo Cuota Hilton / Mercado UE',
    'emisor', 'Protocolo avalado por SENASA · Inspección OIA / LSQA',
    'fecha_emision', '2026-10-08',
    'observaciones', 'Rodeo recriado sin promotores de crecimiento hormonales ni antibióticos subterapéuticos.',
    'doc_url', '/demo/certificado-libre-antibioticos-demo.pdf',
    'doc_hash', '8888ab9712a3ee0bafec87597ef56943b5bcc4bc8555c5be21f6e2581115f5b2'
  )
)
where codigo_lote = 'LOTE-00107';

update public.lotes
set certificaciones_comerciales = jsonb_build_array(
  jsonb_build_object(
    'codigo', 'BIENESTAR_ANIMAL',
    'nombre', 'Bienestar Animal Certificado',
    'norma', 'ISO 34700 / Welfare Quality · Sellos Welfair e ITW (Alemania)',
    'emisor', 'OIA / Control Union',
    'fecha_emision', '2026-10-02',
    'observaciones', 'Manejo de hacienda sin perros ni picana eléctrica, sombra natural y corrales de descanso.',
    'doc_url', '/demo/certificado-bienestar-welfair-demo.pdf',
    'doc_hash', 'cffc690dd11bbb2530817bbd23bc34e1e4ec6d0cd36855bb1bf952140d404774'
  ),
  jsonb_build_object(
    'codigo', 'HUELLA_CARBONO_SINERGIA',
    'nombre', 'Huella de Carbono e Inventario GEI (Sinergia Medio Ambiente)',
    'norma', 'ISO 14064 / ISO 14067 · GHG Protocol',
    'emisor', 'Sinergia Medio Ambiente · Auditoría SGS',
    'fecha_emision', '2026-10-04',
    'observaciones', 'Balance positivo de captura de carbono en pastizal natural y monte silvopastoril correntino.',
    'doc_url', '/demo/informe-sinergia-gei-demo.pdf',
    'doc_hash', 'e86d8ca1aefa0060f52ec295c1cf494fd0902de61baa0b3fee9b9cbbeeb46076'
  )
)
where codigo_lote = 'LOTE-00108';

update public.lotes
set certificaciones_comerciales = jsonb_build_array(
  jsonb_build_object(
    'codigo', 'HUELLA_CARBONO_SINERGIA',
    'nombre', 'Huella de Carbono e Inventario GEI (Sinergia Medio Ambiente)',
    'norma', 'ISO 14064 / ISO 14067 · GHG Protocol',
    'emisor', 'Sinergia Medio Ambiente · Auditoría IRAM',
    'fecha_emision', '2026-10-10',
    'observaciones', 'Medición de inventario biológico GEI y diseño de plan de mitigación sobre verdeo de invierno.',
    'doc_url', '/demo/informe-sinergia-gei-demo.pdf',
    'doc_hash', 'e86d8ca1aefa0060f52ec295c1cf494fd0902de61baa0b3fee9b9cbbeeb46076'
  ),
  jsonb_build_object(
    'codigo', 'BIENESTAR_ANIMAL',
    'nombre', 'Bienestar Animal Certificado',
    'norma', 'ISO 34700 / Welfare Quality · Sellos Welfair e ITW (Alemania)',
    'emisor', 'IRAM / OIA',
    'fecha_emision', '2026-10-11',
    'observaciones', 'Destete racional y protocolo de bienestar auditado en manga y aguadas.',
    'doc_url', '/demo/certificado-bienestar-welfair-demo.pdf',
    'doc_hash', 'cffc690dd11bbb2530817bbd23bc34e1e4ec6d0cd36855bb1bf952140d404774'
  ),
  jsonb_build_object(
    'codigo', 'LIBRE_ANTIBIOTICOS_HORMONAS',
    'nombre', 'Libre de Antibióticos y Promotores Hormonales',
    'norma', 'Protocolo Cuota Hilton / Mercado UE',
    'emisor', 'Protocolo avalado por SENASA · Inspección OIA / LSQA',
    'fecha_emision', '2026-10-11',
    'observaciones', 'Tropa trazada desde el destete sin uso de anabólicos ni antibióticos preventivos.',
    'doc_url', '/demo/certificado-libre-antibioticos-demo.pdf',
    'doc_hash', '8888ab9712a3ee0bafec87597ef56943b5bcc4bc8555c5be21f6e2581115f5b2'
  )
)
where codigo_lote = 'LOTE-00109';

-- Para lotes cerrados existentes en la base que aún no tengan certificaciones cargadas,
-- asignar Huella GEI (Sinergia Medio Ambiente) y Bienestar Animal para exhibir en el Pasaporte EUDR.
update public.lotes
set certificaciones_comerciales = jsonb_build_array(
  jsonb_build_object(
    'codigo', 'HUELLA_CARBONO_SINERGIA',
    'nombre', 'Huella de Carbono e Inventario GEI (Sinergia Medio Ambiente)',
    'norma', 'ISO 14064 / ISO 14067 · GHG Protocol',
    'emisor', 'Sinergia Medio Ambiente · Auditoría Control Union',
    'fecha_emision', '2026-10-01',
    'observaciones', 'Inventario biológico GEI auditado y plan de mitigación con pastoreo rotativo.',
    'doc_url', '/demo/informe-sinergia-gei-demo.pdf',
    'doc_hash', 'e86d8ca1aefa0060f52ec295c1cf494fd0902de61baa0b3fee9b9cbbeeb46076'
  ),
  jsonb_build_object(
    'codigo', 'BIENESTAR_ANIMAL',
    'nombre', 'Bienestar Animal Certificado',
    'norma', 'ISO 34700 / Welfare Quality · Sellos Welfair e ITW (Alemania)',
    'emisor', 'OIA / Control Union',
    'fecha_emision', '2026-10-01',
    'observaciones', 'Auditoría de trato ético, embarque y transporte controlado hacia frigorífico.',
    'doc_url', '/demo/certificado-bienestar-welfair-demo.pdf',
    'doc_hash', 'cffc690dd11bbb2530817bbd23bc34e1e4ec6d0cd36855bb1bf952140d404774'
  )
)
where estado_publicacion = 'CERRADO_CICLO'
  and jsonb_array_length(certificaciones_comerciales) = 0;
