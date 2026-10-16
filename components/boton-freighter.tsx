'use client';

import { useEffect, useState } from 'react';
import { conectarFreighter } from '@/lib/freighter';
import { isConnected } from '@stellar/freighter-api';

export function BotonFreighter({
  onConectado,
  walletActual,
}: {
  onConectado?: (direccion: string) => void;
  walletActual?: string;
}) {
  const [direccion, setDireccion] = useState<string>(walletActual ?? '');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instalado, setInstalado] = useState<boolean | null>(null);

  useEffect(() => {
    void isConnected()
      .then((c) => setInstalado(c.isConnected))
      .catch(() => setInstalado(false));
  }, []);

  const handleConectar = async () => {
    setCargando(true);
    setError(null);
    try {
      const addr = await conectarFreighter();
      setDireccion(addr);
      onConectado?.(addr);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  };

  if (instalado === false) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        Freighter no está instalado.{' '}
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noreferrer"
          className="underline font-semibold hover:text-amber-100"
        >
          Instalar extensión Freighter
        </a>{' '}
        para firmar transacciones con tu wallet en testnet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleConectar()}
          disabled={cargando}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-50"
        >
          <span className={`h-2 w-2 rounded-full ${direccion ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
          {cargando
            ? 'Conectando...'
            : direccion
              ? `Freighter: ${direccion.slice(0, 4)}…${direccion.slice(-4)}`
              : 'Conectar Freighter'}
        </button>
        {direccion && (
          <span className="text-xs text-neutral-400">
            Wallet conectada para firmar en Soroban testnet
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
