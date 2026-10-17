'use client';

import { useState, useRef, useEffect } from 'react';
import type { DocumentoHash } from '@/lib/documentos-hashes';

export type DocumentosHashesProps = {
  documentos?: DocumentoHash[];
  videoUrl?: string | null;
  renspaHash?: string | null;
  renspaUrl?: string | null;
  rfidHash?: string | null;
  eudrGeoHash?: string | null;
  actaHash?: string | null;
  actaUrl?: string | null;
  dteHash?: string | null;
  dteUrl?: string | null;
  boletoUrl?: string | null;
};

type DocumentoDef = {
  id: string;
  nombre: string;
  descripcion: string;
  sello: string;
  hash: string | null | undefined;
  docUrl?: string | null;
  docLabel?: string;
  pendienteTexto: string;
};

const SELLO_POR_CLAVE: Record<string, string> = {
  renspa_doc_hash: 'Sello 1 · Origen',
  rfid_list_hash: 'Sello 1 · Identidad',
  eudr_geo_hash: 'Sello 1 · EUDR',
  ada_hash: 'Sello 2 · Sanidad',
  dte_pdf_hash: 'Sello 3 · Cierre',
};

function truncarHash(hash: string): string {
  if (hash.length <= 26) return hash;
  return `${hash.slice(0, 14)}…${hash.slice(-10)}`;
}

export function DocumentosHashes({
  documentos: documentosProp,
  videoUrl,
  renspaHash,
  renspaUrl,
  rfidHash,
  eudrGeoHash,
  actaHash,
  actaUrl,
  dteHash,
  dteUrl,
  boletoUrl,
}: DocumentosHashesProps) {
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [estaPausado, setEstaPausado] = useState(false);
  const [estaSilenciado, setEstaSilenciado] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoSrc = videoUrl && videoUrl.trim().length > 0 ? videoUrl : '/demo/ganado-loop.mp4';

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.defaultMuted = true;
    v.muted = true;
    void v.play().catch(() => {});
  }, [videoSrc]);

  async function copiarAlPortapapeles(id: string, texto: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(texto);
      }
      setCopiadoId(id);
      setTimeout(() => {
        setCopiadoId((prev) => (prev === id ? null : prev));
      }, 2000);
    } catch {
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 2000);
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setEstaPausado(false);
    } else {
      v.pause();
      setEstaPausado(true);
    }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setEstaSilenciado(v.muted);
  }

  function toggleFullscreen() {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (v.requestFullscreen) {
      void v.requestFullscreen();
    }
  }

  const documentos: DocumentoDef[] = documentosProp
    ? documentosProp.map((doc) => ({
        id: doc.clave,
        nombre: doc.titulo,
        descripcion: doc.garantia,
        sello: SELLO_POR_CLAVE[doc.clave] ?? 'Sello on-chain',
        hash: doc.hash,
        docUrl:
          doc.clave === 'renspa_doc_hash'
            ? renspaUrl
            : doc.clave === 'ada_hash'
              ? actaUrl
              : doc.clave === 'dte_pdf_hash'
                ? dteUrl
                : null,
        docLabel:
          doc.clave === 'renspa_doc_hash'
            ? 'Ver constancia RENSPA ↗'
            : doc.clave === 'ada_hash'
              ? 'Ver acta veterinaria ↗'
              : doc.clave === 'dte_pdf_hash'
                ? 'Ver DT-e oficial ↗'
                : undefined,
        pendienteTexto: doc.pendiente,
      }))
    : [
        {
          id: 'renspa',
          nombre: 'Constancia oficial RENSPA (SENASA)',
          descripcion: 'Certifica la habilitación sanitaria y origen del establecimiento.',
          sello: 'Sello 1 · Origen',
          hash: renspaHash,
          docUrl: renspaUrl,
          docLabel: 'Ver constancia RENSPA ↗',
          pendienteTexto: 'Pendiente de emisión oficial',
        },
        {
          id: 'rfid',
          nombre: 'Padrón de caravanas electrónicas (RFID)',
          descripcion: 'Certifica la identidad de los animales del lote (chips oficiales 032).',
          sello: 'Sello 1 · Identidad',
          hash: rfidHash,
          pendienteTexto: 'Pendiente de vinculación RFID',
        },
        {
          id: 'eudr',
          nombre: 'Geolocalización del polígono (EUDR)',
          descripcion: 'Certifica las coordenadas auditadas satelitalmente contra deforestación.',
          sello: 'Sello 1 · EUDR',
          hash: eudrGeoHash,
          pendienteTexto: 'Pendiente de auditoría satelital',
        },
        {
          id: 'ada',
          nombre: 'Acta de auditoría veterinaria (Mes 4)',
          descripcion: 'Acta oficial SIGSA y pesada de control biológico (Sello 2).',
          sello: 'Sello 2 · Sanidad',
          hash: actaHash,
          docUrl: actaUrl,
          docLabel: 'Ver acta veterinaria ↗',
          pendienteTexto: 'Pendiente de auditoría Mes 4',
        },
        {
          id: 'dte',
          nombre: 'DT-e de tránsito hacia faena',
          descripcion: 'Documento de traslado oficial SENASA y recepción (Sello 3).',
          sello: 'Sello 3 · Cierre',
          hash: dteHash,
          docUrl: dteUrl,
          docLabel: 'Ver DT-e oficial ↗',
          pendienteTexto: 'Pendiente de despacho a faena',
        },
      ];

  return (
    <section className="rounded-tarjeta border-borde bg-panel overflow-hidden border">
      {/* 1. Header con video responsivo en bucle continuo */}
      <div className="bg-panel-elevado relative aspect-video w-full overflow-hidden">
        <video
          ref={videoRef}
          src={videoSrc}
          poster="/demo/ganado-poster.jpg"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
          aria-label="Verificación visual del ganado en pastura"
        />

        {/* Gradiente sutil para legibilidad de overlays */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/60" />

        {/* Badge flotante superpuesto */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700/80 bg-neutral-950/80 px-2.5 py-1 text-xs font-medium text-neutral-200 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="bg-brand absolute inline-flex h-full w-full animate-ping rounded-full text-neutral-950 opacity-75" />
              <span className="bg-brand relative inline-flex h-2 w-2 rounded-full text-neutral-950" />
            </span>
            Tropa en pastura natural · Verificación visual
          </span>
        </div>

        {/* Controles discretos del reproductor */}
        <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={togglePlay}
            className="rounded-control focus-visible:ring-foco border border-neutral-700/80 bg-neutral-950/80 p-1.5 text-neutral-300 backdrop-blur-sm transition-colors hover:border-neutral-500 hover:text-white focus-visible:ring-2 focus-visible:outline-none"
            title={estaPausado ? 'Reanudar video' : 'Pausar video'}
            aria-label={estaPausado ? 'Reanudar video' : 'Pausar video'}
          >
            {estaPausado ? (
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="rounded-control focus-visible:ring-foco border border-neutral-700/80 bg-neutral-950/80 p-1.5 text-neutral-300 backdrop-blur-sm transition-colors hover:border-neutral-500 hover:text-white focus-visible:ring-2 focus-visible:outline-none"
            title={estaSilenciado ? 'Activar sonido' : 'Silenciar sonido'}
            aria-label={estaSilenciado ? 'Activar sonido' : 'Silenciar sonido'}
          >
            {estaSilenciado ? (
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-control focus-visible:ring-foco border border-neutral-700/80 bg-neutral-950/80 p-1.5 text-neutral-300 backdrop-blur-sm transition-colors hover:border-neutral-500 hover:text-white focus-visible:ring-2 focus-visible:outline-none"
            title="Pantalla completa"
            aria-label="Pantalla completa"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Cuerpo de documentos y hashes */}
      <div className="p-5">
        <div className="border-borde flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Documentos y hashes</h2>
            <p className="text-texto-suave mt-0.5 text-xs">
              Cada documento queda sellado con una huella digital que no se puede alterar.
            </p>
          </div>
          <span className="text-texto-tenue font-mono text-xs">SHA-256 · Soroban</span>
        </div>

        <div className="mt-4 space-y-3">
          {documentos.map((doc) => {
            const hashValor =
              typeof doc.hash === 'string' && doc.hash.trim().length > 0 ? doc.hash : null;
            const esCopiado = copiadoId === doc.id;

            return (
              <div
                key={doc.id}
                className="rounded-tarjeta border-borde bg-panel hover:border-borde-fuerte border p-3.5 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-texto text-sm font-medium">{doc.nombre}</span>
                      <span className="border-borde bg-panel text-texto-suave rounded border px-1.5 py-0.5 font-mono text-[10px]">
                        {doc.sello}
                      </span>
                    </div>
                    <p className="text-texto-suave mt-1 text-xs">{doc.descripcion}</p>
                  </div>

                  {doc.docUrl && (
                    <a
                      href={doc.docUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-visible:ring-foco text-brand-fuerte hover:text-brand-fuerte/80 inline-flex items-center gap-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {doc.docLabel ?? 'Ver documento ↗'}
                    </a>
                  )}
                </div>

                {/* Fila del hash o estado pendiente */}
                <div className="border-borde mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs">
                  {hashValor ? (
                    <>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-texto-tenue text-[11px] font-medium tracking-wider uppercase">
                          Hash:
                        </span>
                        <code className="text-texto-suave truncate font-mono" title={hashValor}>
                          {truncarHash(hashValor)}
                        </code>
                      </div>

                      <button
                        type="button"
                        onClick={() => void copiarAlPortapapeles(doc.id, hashValor)}
                        className={`rounded-control focus-visible:ring-foco inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                          esCopiado
                            ? 'border-brand-fuerte/40 bg-brand/10 text-brand-fuerte'
                            : 'border-borde-fuerte bg-panel-elevado text-texto-suave hover:border-texto-tenue hover:text-texto'
                        }`}
                        title="Copiar hash SHA-256 al portapapeles"
                      >
                        {esCopiado ? (
                          <>
                            <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                              <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                            </svg>
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                            </svg>
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <div className="text-texto-tenue flex items-center gap-1.5">
                      <span className="bg-texto-tenue inline-block h-1.5 w-1.5 rounded-full" />
                      <span className="font-mono text-xs">{doc.pendienteTexto}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {boletoUrl && (
            <div className="rounded-tarjeta border-borde bg-panel flex items-center justify-between border p-3 text-xs">
              <span className="text-texto-suave">Boleto de marca oficial (diseño y señal)</span>
              <a
                href={boletoUrl}
                target="_blank"
                rel="noreferrer"
                className="focus-visible:ring-foco text-brand-fuerte hover:text-brand-fuerte/80 font-medium focus-visible:ring-2 focus-visible:outline-none"
              >
                Ver boleto de marca ↗
              </a>
            </div>
          )}
        </div>

        {/* 3. Cuadro explicativo de inmutabilidad on-chain */}
        <div className="rounded-tarjeta border-brand-fuerte/30 bg-brand/5 text-texto-suave mt-5 border p-4 text-xs">
          <div className="flex items-start gap-2.5">
            <svg
              className="text-brand-fuerte mt-0.5 h-4 w-4 shrink-0 fill-current"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z"
                clipRule="evenodd"
              />
            </svg>
            <div className="space-y-1">
              <p className="font-semibold text-white">Garantía criptográfica on-chain</p>
              <p className="text-texto-suave leading-relaxed">
                Cada documento y polígono cuenta con una huella digital criptográfica (hash SHA-256)
                anclada en la blockchain de Stellar/Soroban. Esto garantiza que ningún dato pueda
                ser alterado ni adulterado posteriormente ante auditorías sanitarias o compradores
                internacionales.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
