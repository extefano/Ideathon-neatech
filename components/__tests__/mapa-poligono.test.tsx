// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MapaPoligono from '@/components/mapa-poligono';

vi.mock('react-leaflet', () => {
  const mapaFalso = {
    getZoom: () => 12,
    flyTo: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getContainer: () => document.createElement('div'),
    fitBounds: vi.fn(),
  };

  return {
    MapContainer: ({
      children,
      bounds,
      center,
      zoom,
    }: {
      children?: ReactNode;
      bounds?: unknown;
      center?: unknown;
      zoom?: unknown;
    }) => (
      <div
        data-testid="mapa"
        data-bounds={bounds == null ? '' : JSON.stringify(bounds)}
        data-center={center == null ? '' : JSON.stringify(center)}
        data-zoom={zoom == null ? '' : String(zoom)}
      >
        {children}
      </div>
    ),
    Polygon: () => <div data-testid="poligono" />,
    TileLayer: () => null,
    useMap: () => mapaFalso,
  };
});

describe('MapaPoligono', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: vi.fn() },
      configurable: true,
    });
  });

  it('encuadra el lote guardado por bounds sin pedir la geolocalización del visitante', () => {
    const poligono = {
      type: 'Polygon',
      coordinates: [
        [
          [-61.9, -33.7],
          [-61.84, -33.7],
          [-61.84, -33.65],
          [-61.9, -33.65],
          [-61.9, -33.7],
        ],
      ],
    };

    render(<MapaPoligono poligono={poligono} />);

    const mapa = screen.getByTestId('mapa');

    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(mapa.dataset.bounds).toBe(
      '[[-33.7,-61.9],[-33.7,-61.84],[-33.65,-61.84],[-33.65,-61.9],[-33.7,-61.9]]',
    );
    expect(mapa.dataset.center).toBe('');
    expect(mapa.dataset.zoom).toBe('');
    expect(screen.getByTestId('poligono')).toBeInTheDocument();
    expect(screen.queryByText('Mi ubicación')).toBeNull();
  });

  it('sin polígono usa centro y zoom por defecto sin bounds', () => {
    render(<MapaPoligono poligono={null} />);

    const mapa = screen.getByTestId('mapa');

    expect(mapa.dataset.bounds).toBe('');
    expect(mapa.dataset.center).toBe('[-29.19,-58.08]');
    expect(mapa.dataset.zoom).toBe('13');
    expect(screen.queryByTestId('poligono')).toBeNull();
  });
});
