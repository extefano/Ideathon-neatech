'use client';

import { Aviso } from '@/components/ui/aviso';
import { CopiaHash } from '@/components/ui/copia-hash';
import { Tarjeta } from '@/components/ui/tarjeta';
import type { DocumentoHash } from '@/lib/documentos-hashes';

export function DocumentosHashes({
  documentos,
  videoUrl,
}: {
  documentos: DocumentoHash[];
  videoUrl?: string | null;
}) {
  return (
    <Tarjeta
      titulo="Documentos y hashes"
      descripcion="Cada documento queda sellado con una huella digital que no se puede alterar."
    >
      <div className="rounded-tarjeta border-borde relative overflow-hidden border">
        <video
          className="aspect-video w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          src={videoUrl || '/demo/ganado-loop.mp4'}
          aria-label="Video de la tropa en el campo"
        />
        <span className="bg-superficie/80 text-brand absolute bottom-2 left-2 rounded px-2 py-1 text-xs font-semibold">
          Tropa en pastura natural · Verificación visual
        </span>
      </div>

      <ul className="mt-4 space-y-3">
        {documentos.map((documento) => (
          <li key={documento.clave} className="border-b border-neutral-900 pb-3 last:border-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-neutral-100">{documento.titulo}</p>
                <p className="text-xs text-neutral-500">{documento.garantia}</p>
              </div>
              {documento.hash ? (
                <CopiaHash valor={documento.hash} />
              ) : (
                <span className="text-xs text-neutral-500">{documento.pendiente}</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Aviso variante="info" className="mt-4">
        Cada documento y polígono cuenta con una huella digital criptográfica (hash SHA-256) anclada
        en la blockchain de Stellar/Soroban. Esto garantiza que ningún dato pueda ser alterado ni
        adulterado posteriormente.
      </Aviso>
    </Tarjeta>
  );
}
