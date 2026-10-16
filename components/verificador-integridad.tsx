'use client';

import { useState, type ChangeEvent } from 'react';

type HashEsperado = { etiqueta: string; hash: string };

function bufferAHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function VerificadorIntegridad({ hashes }: { hashes: HashEsperado[] }) {
  const [resultado, setResultado] = useState<{
    archivo: string;
    hash: string;
    match: string | null;
  } | null>(null);

  async function alSeleccionarArchivo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const hash = bufferAHex(await crypto.subtle.digest('SHA-256', buffer));
    const encontrado = hashes.find((h) => h.hash.toLowerCase() === hash) ?? null;
    setResultado({ archivo: file.name, hash, match: encontrado?.etiqueta ?? null });
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-5">
      <h2 className="text-lg font-semibold">Auditar integridad de un archivo (SHA-256)</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Arrastrá o elegí un documento (PDF del RENSPA, acta de vacunación, DT-e, etc.). El hash se
        calcula localmente en tu navegador y se compara contra los hashes anclados en Stellar.
      </p>
      <input
        type="file"
        className="mt-3 block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        onChange={(event) => void alSeleccionarArchivo(event)}
      />
      {resultado && (
        <div className="mt-3 text-xs">
          <p className="font-mono break-all text-neutral-400">
            {resultado.archivo}: {resultado.hash}
          </p>
          {resultado.match ? (
            <p className="mt-2 rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-emerald-300">
              ✔ Íntegro — coincide con <span className="font-mono">{resultado.match}</span>{' '}
              registrado en el contrato.
            </p>
          ) : (
            <p className="mt-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-red-300">
              ✘ El archivo no coincide con ninguno de los hashes registrados en el contrato.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
