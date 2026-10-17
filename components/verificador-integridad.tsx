'use client';

import { useState, type ChangeEvent, type DragEvent } from 'react';
import { Aviso } from '@/components/ui/aviso';
import { Tarjeta } from '@/components/ui/tarjeta';

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

  async function verificar(file: File) {
    const buffer = await file.arrayBuffer();
    const hash = bufferAHex(await crypto.subtle.digest('SHA-256', buffer));
    const encontrado = hashes.find((h) => h.hash.toLowerCase() === hash) ?? null;
    setResultado({ archivo: file.name, hash, match: encontrado?.etiqueta ?? null });
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

  return (
    <Tarjeta
      titulo="Verificá un documento"
      descripcion="Arrastrá el PDF o la imagen para comprobar que no fue alterado."
    >
      <label
        htmlFor="verificador-archivo"
        onDragOver={(event) => event.preventDefault()}
        onDrop={alSoltar}
        className="rounded-tarjeta focus-within:ring-foco border-borde bg-panel flex cursor-pointer flex-col items-center justify-center border border-dashed p-6 text-center focus-within:ring-2"
      >
        <span className="text-texto text-sm font-semibold">Arrastrá un archivo acá o elegilo</span>
        <span className="text-texto-tenue mt-1 text-xs">
          El hash se calcula en tu navegador; el archivo no se sube a ningún servidor.
        </span>
        <input
          id="verificador-archivo"
          type="file"
          className="text-texto-suave mt-3 block w-full max-w-xs text-sm"
          onChange={alSeleccionarArchivo}
        />
      </label>

      {resultado && (
        <div className="mt-4 space-y-2 text-xs">
          <p className="text-texto-suave font-mono break-all">
            {resultado.archivo}: {resultado.hash}
          </p>
          {resultado.match ? (
            <Aviso variante="exito" titulo="Documento íntegro">
              Coincide con “{resultado.match}” registrado en el contrato.
            </Aviso>
          ) : (
            <Aviso variante="error" titulo="El documento no coincide">
              No coincide con ninguno de los hashes registrados en el contrato.
            </Aviso>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
