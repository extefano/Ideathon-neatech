import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  ),
  title: {
    default: 'Muunar — Trazabilidad ganadera EUDR',
    template: '%s · Muunar',
  },
  description:
    'Trazabilidad ganadera EUDR con sellos verificables en Stellar (Soroban) y liquidaciones con escrow USDC.',
  applicationName: 'Muunar',
  openGraph: {
    title: 'Muunar — Trazabilidad ganadera EUDR',
    description:
      'Sellos de origen libre de deforestación, sanidad y faena con liquidaciones en escrow USDC sobre Stellar.',
    type: 'website',
    locale: 'es_AR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Muunar — Trazabilidad ganadera EUDR',
    description:
      'Sellos de origen libre de deforestación, sanidad y faena con liquidaciones en escrow USDC sobre Stellar.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
