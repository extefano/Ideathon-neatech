'use client';

import { useState, type ChangeEvent, type DragEvent } from 'react';
import { Aviso } from '@/components/ui/aviso';
import { Tarjeta } from '@/components/ui/tarjeta';

export type HashEsperado = { etiqueta: string; hash: string };

/** Compara contra las huellas publicadas del lote (no contra la cadena). */
export function compararConHashes(hashes: HashEsperado[], hash: string): string | null {
  const normal = hash.toLowerCase();
  return hashes.find((esperado) => esperado.hash.toLowerCase() === normal)?.etiqueta ?? null;
}

export function textoComparacion(match: string | null): {
  variante: 'exito' | 'error';
  titulo: string;
  detalle: string;
} {
  return match
    ? {
        variante: 'exito',
        titulo: 'Documento íntegro',
        detalle: `Coincide con “${match}”, una de las huellas publicadas del lote.`,
      }
    : {
        variante: 'error',
        titulo: 'El documento no coincide',
        detalle: 'No coincide con ninguna de las huellas publicadas del lote.',
      };
}

function bufferAHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function VerificadorIntegridad({ hashes }: { hashes: HashEsperado[] }) {
  const [resultado, setResultado] = useState<{
    archivo: string;
    hash: string;
    match: string | null;
  } | null>(null);

  async function verificar(file: File) {
    const buffer = await file.arrayBuffer();
    const hash = bufferAHex(await crypto.subtle.digest('SHA-256', buffer));
    setResultado({ archivo: file.name, hash, match: compararConHashes(hashes, hash) });
  }

  function alSeleccionarArchivo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void verificar(file);
  }

  function alSoltar(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void verificar(file);
  }

  const aviso = resultado ? textoComparacion(resultado.match) : null;

  return (
    <Tarjeta
      titulo="Verificá un documento"
      descripcion="Arrastrá el PDF o la imagen para comprobar que coincide con la huella publicada del lote."
    >
      <label
        htmlFor="verificador-archivo"
        onDragOver={(event) => event.preventDefault()}
        onDrop={alSoltar}
        className="rounded-tarjeta focus-within:ring-foco border-borde bg-panel flex cursor-pointer flex-col items-center justify-center border border-dashed p-6 text-center focus-within:ring-2"
      >
        <span className="text-sm font-semibold text-neutral-200">
          Arrastrá un archivo acá o elegilo
        </span>
        <span className="mt-1 text-xs text-neutral-500">
          El hash se calcula en tu navegador; el archivo no se sube a ningún servidor.
        </span>
        <input
          id="verificador-archivo"
          type="file"
          className="mt-3 block w-full max-w-xs text-sm text-neutral-300"
          onChange={alSeleccionarArchivo}
        />
      </label>

      {resultado && aviso && (
        <div className="mt-4 space-y-2 text-xs">
          <p className="font-mono break-all text-neutral-400">
            {resultado.archivo}: {resultado.hash}
          </p>
          <Aviso variante={aviso.variante} titulo={aviso.titulo}>
            {aviso.detalle}
          </Aviso>
        </div>
      )}
    </Tarjeta>
  );
}
