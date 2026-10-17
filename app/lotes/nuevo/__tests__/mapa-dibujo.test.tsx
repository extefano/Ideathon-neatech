// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MapaDibujo from '@/app/lotes/nuevo/mapa-dibujo';

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
    MapContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Polygon: () => null,
    Polyline: () => null,
    TileLayer: () => null,
    useMap: () => mapaFalso,
    useMapEvents: () => null,
  };
});

describe('MapaDibujo', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: vi.fn() },
      configurable: true,
    });
  });

  it('conserva el control de geolocalización «Mi ubicación»', () => {
    render(<MapaDibujo puntos={[]} activo={false} onAgregar={() => {}} />);

    expect(screen.getByRole('button', { name: /mi ubicación/i })).toBeInTheDocument();
  });
});
