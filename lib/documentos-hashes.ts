export type DocumentoHash = {
  clave: string;
  titulo: string;
  garantia: string;
  hash: string | null;
  pendiente: string;
};

function limpio(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

/**
 * Traduce las columnas crudas de la base a documentos comprensibles (issue #21).
 * Las etiquetas se reutilizan en el pasaporte público (issue #37).
 */
export function construirDocumentos(input: {
  renspaDocHash: unknown;
  rfidListHash: unknown;
  eudrGeoHash: unknown;
  actaHash: unknown;
  dteHash: unknown;
}): DocumentoHash[] {
  return [
    {
      clave: 'renspa_doc_hash',
      titulo: 'Constancia oficial RENSPA (SENASA)',
      garantia: 'Certifica la habilitación sanitaria y el origen del establecimiento.',
      hash: limpio(input.renspaDocHash),
      pendiente: 'Pendiente de carga',
    },
    {
      clave: 'rfid_list_hash',
      titulo: 'Padrón de caravanas electrónicas (RFID)',
      garantia: 'Certifica la identidad de los animales del lote (chips 032).',
      hash: limpio(input.rfidListHash),
      pendiente: 'Pendiente de carga',
    },
    {
      clave: 'eudr_geo_hash',
      titulo: 'Geolocalización del polígono (EUDR)',
      garantia: 'Certifica las coordenadas auditadas satelitalmente contra deforestación.',
      hash: limpio(input.eudrGeoHash),
      pendiente: 'Pendiente de validación EUDR',
    },
    {
      clave: 'ada_hash',
      titulo: 'Acta de auditoría veterinaria (Mes 4)',
      garantia: 'Acta oficial SIGSA y pesada de control biológico (Sello 2).',
      hash: limpio(input.actaHash),
      pendiente: 'Pendiente de auditoría del Mes 4',
    },
    {
      clave: 'dte_pdf_hash',
      titulo: 'DT-e de tránsito hacia faena',
      garantia: 'Documento de traslado oficial SENASA (Sello 3).',
      hash: limpio(input.dteHash),
      pendiente: 'Pendiente de despacho y recepción',
    },
  ];
}
