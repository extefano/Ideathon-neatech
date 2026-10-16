import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocumentosHashes } from '@/components/documentos-hashes';

describe('DocumentosHashes component', () => {
  it('renderiza el reproductor de video con autoplay, loop, muted y playsinline', () => {
    const html = renderToStaticMarkup(
      <DocumentosHashes
        videoUrl={null}
        renspaHash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      />,
    );

    expect(html).toContain('<video');
    expect(html).toContain('autoPlay=""');
    expect(html).toContain('loop=""');
    expect(html).toContain('muted=""');
    expect(html).toContain('playsInline=""');
    expect(html).toContain('/demo/ganado-loop.mp4');
    expect(html).toContain('Tropa en pastura natural · Verificación visual');
  });

  it('utiliza la URL de video provista cuando videoUrl está presente', () => {
    const html = renderToStaticMarkup(
      <DocumentosHashes videoUrl="https://cdn.ejemplo.com/lote-104-drone.mp4" />,
    );

    expect(html).toContain('src="https://cdn.ejemplo.com/lote-104-drone.mp4"');
  });

  it('muestra los 5 conceptos pedagógicos oficiales y sus garantías', () => {
    const html = renderToStaticMarkup(
      <DocumentosHashes
        renspaHash="hash-renspa-demo"
        renspaUrl="https://storage.ejemplo.com/renspa.pdf"
        rfidHash="hash-rfid-demo"
        eudrGeoHash="hash-eudr-demo"
        actaHash={null}
        dteHash={null}
        boletoUrl="https://storage.ejemplo.com/boleto.pdf"
      />,
    );

    // Conceptos pedagógicos
    expect(html).toContain('Constancia oficial RENSPA (SENASA)');
    expect(html).toContain('Certifica la habilitación sanitaria y origen del establecimiento.');

    expect(html).toContain('Padrón de caravanas electrónicas (RFID)');
    expect(html).toContain(
      'Certifica la identidad de los animales del lote (chips oficiales 032).',
    );

    expect(html).toContain('Geolocalización del polígono (EUDR)');
    expect(html).toContain(
      'Certifica las coordenadas auditadas satelitalmente contra deforestación.',
    );

    expect(html).toContain('Acta de auditoría veterinaria (Mes 4)');
    expect(html).toContain('Acta oficial SIGSA y pesada de control biológico (Sello 2).');

    expect(html).toContain('DT-e de tránsito hacia faena');
    expect(html).toContain('Documento de traslado oficial SENASA y recepción (Sello 3).');

    // Enlaces a documentos disponibles
    expect(html).toContain('Ver constancia RENSPA ↗');
    expect(html).toContain('Ver boleto de marca ↗');

    // Estados pendientes descriptivos para sellos no ejecutados
    expect(html).toContain('Pendiente de auditoría Mes 4');
    expect(html).toContain('Pendiente de despacho a faena');

    // Explicación de inmutabilidad on-chain
    expect(html).toContain('Garantía criptográfica on-chain');
    expect(html).toContain('blockchain de Stellar/Soroban');
  });
});
