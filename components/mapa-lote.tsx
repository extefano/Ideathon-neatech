'use client';

import dynamic from 'next/dynamic';

export const MapaLote = dynamic(() => import('@/components/mapa-poligono'), {
  ssr: false,
  loading: () => <div className="border-borde-fuerte bg-panel h-64 rounded-md border" />,
});

export const MapaPasaporte = dynamic(() => import('@/components/mapa-poligono'), {
  ssr: false,
  loading: () => <div className="border-borde-fuerte bg-panel h-80 rounded-md border" />,
});
