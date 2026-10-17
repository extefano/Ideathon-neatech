// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CertificacionesComerciales } from '@/components/certificaciones-comerciales';
import { LoteCard } from '@/components/lote-card';
import { LotesMarketplace } from '@/components/lotes-marketplace';
import type { LoteListItem } from '@/lib/queries';

const lote7: LoteListItem = {
  id: 'lote-7',
  codigo_lote: 'LOTE-00107',
  titulo: '40 Novillitos Hereford - 240 kg',
  estado_publicacion: 'DISPONIBLE',
  provincia: 'Santa Fe',
  localidad: 'Venado Tuerto',
  categoria: 'Novillitos',
  raza: 'Hereford',
  cantidad_cabezas: 40,
  peso_promedio_kg: 240,
  peso_objetivo_kg: 420,
  monto_total_financiacion: 14000,
  moneda: 'USDC',
  seal_1_eudr: true,
  seal_2_sanitary: false,
  seal_3_reception: false,
  certificaciones_comerciales: [
    {
      codigo: 'HUELLA_CARBONO_SINERGIA',
      nombre: 'Huella de Carbono e Inventario GEI (Sinergia Medio Ambiente)',
      norma: 'ISO 14064 / ISO 14067 · GHG Protocol',
      emisor: 'Sinergia Medio Ambiente · Auditoría IRAM / Control Union',
      fecha_emision: '2026-10-05',
      observaciones: 'Inventario biológico GEI y plan de pastoreo rotativo.',
      doc_url: '/demo/informe-sinergia-gei-demo.pdf',
      doc_hash: 'e86d8ca1aefa0060f52ec295c1cf494fd0902de61baa0b3fee9b9cbbeeb46076',
    },
    {
      codigo: 'LIBRE_ANTIBIOTICOS_HORMONAS',
      nombre: 'Libre de Antibióticos y Promotores Hormonales',
      norma: 'Protocolo Cuota Hilton / Mercado UE',
      emisor: 'Protocolo avalado por SENASA · Inspección OIA / LSQA',
      fecha_emision: '2026-10-08',
      observaciones: 'Sin promotores hormonales.',
      doc_url: '/demo/certificado-libre-antibioticos-demo.pdf',
      doc_hash: '8888ab9712a3ee0bafec87597ef56943b5bcc4bc8555c5be21f6e2581115f5b2',
    },
  ],
  created_at: '2026-10-16T05:00:00.000Z',
};

const lote8: LoteListItem = {
  ...lote7,
  id: 'lote-8',
  codigo_lote: 'LOTE-00108',
  titulo: '25 Vacas Braford CUT - 380 kg',
  certificaciones_comerciales: [
    {
      codigo: 'BIENESTAR_ANIMAL',
      nombre: 'Bienestar Animal Certificado',
      norma: 'ISO 34700 / Welfare Quality · Sellos Welfair e ITW (Alemania)',
      emisor: 'OIA / Control Union',
      fecha_emision: '2026-10-02',
      observaciones: 'Manejo ético auditado.',
      doc_url: '/demo/certificado-bienestar-welfair-demo.pdf',
      doc_hash: 'cffc690dd11bbb2530817bbd23bc34e1e4ec6d0cd36855bb1bf952140d404774',
    },
  ],
};

describe('LoteCard y LotesMarketplace (Eje 1 vs Eje 2 · #42)', () => {
  it('distingue visualmente los Sellos EUDR (Eje 1) de las certificaciones voluntarias (Eje 2)', () => {
    render(<LoteCard lote={lote7} />);

    expect(screen.getByText(/Sellos EUDR \(Obligatorios · Eje 1\):/i)).toBeInTheDocument();
    expect(screen.getByText('1 · Origen')).toBeInTheDocument();
    expect(screen.getByText(/Valor agregado \(Voluntarios · Eje 2\):/i)).toBeInTheDocument();
    expect(screen.getByText(/GEI · Sinergia/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin Antibióticos/i)).toBeInTheDocument();
  });

  it('permite al Comprador filtrar lotes por preferencia comercial del Eje 2', () => {
    render(<LotesMarketplace lotes={[lote7, lote8]} />);

    expect(screen.getByText('40 Novillitos Hereford - 240 kg')).toBeInTheDocument();
    expect(screen.getByText('25 Vacas Braford CUT - 380 kg')).toBeInTheDocument();

    const btnBienestar = screen.getByRole('button', {
      name: /Bienestar Animal \(Welfair\) \(1\)/i,
    });
    fireEvent.click(btnBienestar);

    expect(btnBienestar).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('40 Novillitos Hereford - 240 kg')).not.toBeInTheDocument();
    expect(screen.getByText('25 Vacas Braford CUT - 380 kg')).toBeInTheDocument();
  });
});

describe('CertificacionesComerciales (Ficha y Pasaporte · #42)', () => {
  it('muestra la jerarquía Eje 1 vs Eje 2, el rol de Sinergia Medio Ambiente, enlace PDF y hash SHA-256', () => {
    render(
      <CertificacionesComerciales
        codigoLote="LOTE-00107"
        certificaciones={lote7.certificaciones_comerciales ?? []}
        permitirEdicion={false}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Certificaciones comerciales y valor agregado/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No reemplazan los 3 sellos obligatorios de acceso aduanero/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /Huella de Carbono e Inventario GEI \(Sinergia Medio Ambiente\)/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ISO 14064 \/ ISO 14067 · GHG Protocol/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver informe PDF/i })).toHaveAttribute(
      'href',
      '/demo/informe-sinergia-gei-demo.pdf',
    );
  });
});
