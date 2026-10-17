// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CertificacionesComerciales } from '@/components/certificaciones-comerciales';
import { LoteCard } from '@/components/lote-card';
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

describe('LoteCard (Eje 1 vs Eje 2 · #42)', () => {
  it('distingue visualmente los Sellos EUDR (Eje 1) como step-progress con tooltip y las certificaciones voluntarias (Eje 2) como píldoras sin ticks', () => {
    const { rerender } = render(
      <LoteCard lote={{ ...lote7, titulo: '[DEMO] 40 Novillitos Hereford - 240 kg' }} />,
    );

    expect(screen.getByRole('heading', { name: '40 Novillitos Hereford' })).toBeInTheDocument();
    expect(screen.getByText('Sellos EUDR')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Estado actual de los sellos EUDR/i }),
    ).toHaveTextContent('?');
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      /Origen verificado \(Sello 1\)\. Esperando que un Comprador deposite el pago en garantía\./i,
    );
    expect(screen.getByRole('list', { name: /Progreso de sellos EUDR/i })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Origen')).toBeInTheDocument();
    expect(screen.getByText('Sanidad').closest('li')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Cierre')).toBeInTheDocument();

    expect(screen.getByText('Valor agregado')).toBeInTheDocument();
    const pildoraGei = screen.getByText(/GEI · Sinergia/i);
    const pildoraAntibioticos = screen.getByText(/Sin Antibióticos/i);
    expect(pildoraGei).toHaveClass('rounded-full');
    expect(pildoraGei.querySelector('svg')).toBeNull();
    expect(pildoraAntibioticos).toHaveClass('rounded-full');
    expect(pildoraAntibioticos.querySelector('svg')).toBeNull();

    rerender(<LoteCard lote={{ ...lote7, estado_publicacion: 'FINANCIADO_EN_ENGORDE' }} />);
    expect(screen.getByText('Sanidad').closest('li')).toHaveAttribute('aria-current', 'step');
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
