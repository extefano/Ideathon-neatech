'use client';

import {
  Check,
  Copy,
  ExternalLink,
  Maximize,
  Pause,
  Play,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
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
            ? 'Ver constancia RENSPA'
            : doc.clave === 'ada_hash'
              ? 'Ver acta veterinaria'
              : doc.clave === 'dte_pdf_hash'
                ? 'Ver DT-e oficial'
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
          docLabel: 'Ver constancia RENSPA',
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
          docLabel: 'Ver acta veterinaria',
          pendienteTexto: 'Pendiente de auditoría Mes 4',
        },
        {
          id: 'dte',
          nombre: 'DT-e de tránsito hacia faena',
          descripcion: 'Documento de traslado oficial SENASA y recepción (Sello 3).',
          sello: 'Sello 3 · Cierre',
          hash: dteHash,
          docUrl: dteUrl,
          docLabel: 'Ver DT-e oficial',
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
              <Play aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Pause aria-hidden="true" className="h-4 w-4" />
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
              <VolumeX aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Volume2 aria-hidden="true" className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-control focus-visible:ring-foco border border-neutral-700/80 bg-neutral-950/80 p-1.5 text-neutral-300 backdrop-blur-sm transition-colors hover:border-neutral-500 hover:text-white focus-visible:ring-2 focus-visible:outline-none"
            title="Pantalla completa"
            aria-label="Pantalla completa"
          >
            <Maximize aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. Cuerpo de documentos y hashes en filas compactas */}
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-texto text-lg font-semibold">Documentos y hashes</h2>
            <p className="text-texto-suave mt-0.5 text-xs">
              Respaldo documental con huella digital SHA-256 inmutable.
            </p>
          </div>
          {boletoUrl && (
            <a
              href={boletoUrl}
              target="_blank"
              rel="noreferrer"
              className="focus-visible:ring-foco text-brand-fuerte hover:text-brand-fuerte/80 inline-flex items-center gap-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
            >
              Ver boleto de marca
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <div className="divide-borde border-borde rounded-tarjeta bg-panel-elevado/25 mt-4 divide-y border">
          {documentos.map((doc) => {
            const hashValor =
              typeof doc.hash === 'string' && doc.hash.trim().length > 0 ? doc.hash : null;
            const esCopiado = copiadoId === doc.id;

            return (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-texto text-xs font-semibold">{doc.nombre}</span>
                    <span className="border-borde bg-panel text-texto-tenue rounded border px-1.5 py-0.5 font-mono text-[10px]">
                      {doc.sello}
                    </span>
                    {doc.docUrl && (
                      <a
                        href={doc.docUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="focus-visible:ring-foco text-brand-fuerte hover:text-brand-fuerte/80 inline-flex items-center gap-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {doc.docLabel ?? 'Ver documento'}
                        <ExternalLink aria-hidden="true" className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-texto-tenue mt-0.5 text-[11px]">{doc.descripcion}</p>
                </div>

                {/* Hash o estado pendiente a la derecha */}
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  {hashValor ? (
                    <>
                      <code
                        className="text-texto-suave bg-panel border-borde rounded border px-2 py-0.5 font-mono text-[11px]"
                        title={hashValor}
                      >
                        {truncarHash(hashValor)}
                      </code>

                      <button
                        type="button"
                        onClick={() => void copiarAlPortapapeles(doc.id, hashValor)}
                        className={`rounded-control focus-visible:ring-foco inline-flex items-center gap-1 border px-2 py-1 font-mono text-[11px] transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                          esCopiado
                            ? 'border-brand-fuerte/40 bg-brand/10 text-brand-fuerte'
                            : 'border-borde-fuerte bg-panel text-texto-suave hover:border-texto-tenue hover:text-texto'
                        }`}
                        title="Copiar hash SHA-256 al portapapeles"
                      >
                        {esCopiado ? (
                          <>
                            <Check aria-hidden="true" strokeWidth={3} className="h-3 w-3" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy aria-hidden="true" className="h-3 w-3" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <span className="text-texto-tenue inline-flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="bg-texto-tenue inline-block h-1.5 w-1.5 rounded-full" />
                      {doc.pendienteTexto}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Nota compacta al pie */}
        <p className="text-texto-tenue mt-3 flex items-center gap-1.5 text-[11px]">
          <ShieldCheck aria-hidden="true" className="text-brand-fuerte h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="text-texto-suave font-medium">
              Garantía criptográfica on-chain:
            </strong>{' '}
            Hashes SHA-256 anclados en la blockchain de Stellar/Soroban.
          </span>
        </p>
      </div>
    </section>
  );
}
