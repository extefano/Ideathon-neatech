'use client';

import { ConnectWallet } from '@/components/connect-wallet';

export function BotonFreighter({
  onConectado,
  walletActual,
}: {
  onConectado?: (direccion: string) => void;
  walletActual?: string;
}) {
  return <ConnectWallet initialAddress={walletActual} onConectado={onConectado} label="" />;
}
