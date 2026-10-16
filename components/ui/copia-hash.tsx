'use client';

import { useState } from 'react';

export function CopiaHash({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="max-w-[16rem] truncate font-mono text-xs text-neutral-300" title={valor}>
        {valor.slice(0, 18)}…{valor.slice(-6)}
      </code>
      <button
        type="button"
        onClick={() => void copiar()}
        aria-label={copiado ? 'Hash copiado' : 'Copiar hash al portapapeles'}
        className="rounded-control focus-visible:ring-foco border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] font-semibold text-neutral-200 hover:border-neutral-500 focus-visible:ring-2 focus-visible:outline-none"
      >
        {copiado ? 'Copiado ✓' : 'Copiar'}
      </button>
    </div>
  );
}
