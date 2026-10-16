'use client';

import dynamic from 'next/dynamic';

export const MapaLote = dynamic(() => import('@/components/mapa-poligono'), {
  ssr: false,
  loading: () => <div className="h-64 rounded-md border border-neutral-700 bg-neutral-900" />,
});

export const MapaPasaporte = dynamic(() => import('@/components/mapa-poligono'), {
  ssr: false,
  loading: () => <div className="h-80 rounded-md border border-neutral-700 bg-neutral-900" />,
});
