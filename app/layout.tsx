import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Muunar',
  description: 'Trazabilidad ganadera EUDR con Stellar y Supabase',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
