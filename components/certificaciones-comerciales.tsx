'use client';

import { Check, ExternalLink } from 'lucide-react';
import { useRef, useState } from 'react';
import { BannerRolRequerido } from '@/components/auth-guard';
import { Boton } from '@/components/ui/boton';
import { CopiaHash } from '@/components/ui/copia-hash';
import { Tarjeta } from '@/components/ui/tarjeta';
import { registrarCertificacionComercialAction } from '@/lib/actions';
import type { PerfilUsuario } from '@/lib/auth';
import {
  CERTIFICACIONES_COMERCIALES,
  obtenerDefinicionCertificacion,
  type CertificacionComercialLote,
  type CodigoCertificacionComercial,
} from '@/lib/domain';

const claseInput =
  'w-full rounded-control border border-borde-fuerte bg-panel px-3 py-2 text-sm text-texto focus-visible:border-brand-fuerte focus-visible:outline-none min-h-11';
const claseLabel = 'mb-1 block text-xs font-semibold tracking-wide text-texto-suave uppercase';

function formatearFecha(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-AR');
}

export type CertificacionConUrlResuelta = CertificacionComercialLote & {
  docUrlResuelta?: string | null;
};

export function CertificacionesComerciales({
  codigoLote,
  certificaciones,
  permitirEdicion = false,
  userActual = null,
}: {
  codigoLote: string;
  certificaciones: CertificacionConUrlResuelta[];
  permitirEdicion?: boolean;
  userActual?: PerfilUsuario | null;
}) {
  const [codigoSeleccionado, setCodigoSeleccionado] =
    useState<CodigoCertificacionComercial>('HUELLA_CARBONO_SINERGIA');
  const defSeleccionada = obtenerDefinicionCertificacion(codigoSeleccionado);
  const existenteSeleccionada = certificaciones.find((c) => c.codigo === codigoSeleccionado);

  const [emisor, setEmisor] = useState(
    existenteSeleccionada?.emisor ?? defSeleccionada.emisorDefault,
  );
  const [observaciones, setObservaciones] = useState(
    existenteSeleccionada?.observaciones ?? defSeleccionada.observacionesDefault,
  );
  const [usarDemoPdf, setUsarDemoPdf] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const puedeEditar = userActual?.rol === 'PRODUCTOR' || userActual?.rol === 'VETERINARIO';

  function cambiarCertificacion(nuevoCodigo: CodigoCertificacionComercial) {
    setCodigoSeleccionado(nuevoCodigo);
    const def = obtenerDefinicionCertificacion(nuevoCodigo);
    const previa = certificaciones.find((c) => c.codigo === nuevoCodigo);
    setEmisor(previa?.emisor ?? def.emisorDefault);
    setObservaciones(previa?.observaciones ?? def.observacionesDefault);
    setUsarDemoPdf(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function cargarPdfDemoSeleccionado() {
    setUsarDemoPdf(true);
    try {
      const res = await fetch(defSeleccionada.demoPdfUrl);
      const blob = await res.blob();
      const file = new File([blob], defSeleccionada.demoPdfNombre, {
        type: 'application/pdf',
      });
      if (fileRef.current && typeof DataTransfer !== 'undefined') {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileRef.current.files = dt.files;
      }
    } catch {
      // Si falla fetch en entorno de test, el flag usar_demo_pdf="true" resuelve en servidor
    }
  }

  return (
    <Tarjeta
      titulo="Certificaciones comerciales y valor agregado"
      descripcion="Diferenciales de mercado para compradores e importadores. No reemplazan los 3 sellos obligatorios de acceso aduanero."
    >
      <div className="space-y-4">
        {certificaciones.length === 0 ? (
          <p className="text-texto-suave text-sm">
            Este lote cuenta con su trazabilidad obligatoria EUDR, sin certificaciones voluntarias
            adicionales declaradas por ahora.
          </p>
        ) : (
          <ul
            className="grid gap-3 md:grid-cols-2"
            aria-label="Certificaciones comerciales del lote"
          >
            {certificaciones.map((cert) => {
              const def = obtenerDefinicionCertificacion(cert.codigo);
              const urlFinal = cert.docUrlResuelta ?? cert.doc_url ?? null;
              const fechaTexto = formatearFecha(cert.fecha_emision);
              const etiquetaEnlace =
                cert.codigo === 'HUELLA_CARBONO_SINERGIA' ? 'Ver informe PDF' : 'Ver certificado';

              return (
                <li
                  key={cert.codigo}
                  className="rounded-tarjeta border-borde bg-panel-elevado/35 flex flex-col justify-between gap-3 border p-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-texto text-sm font-semibold">{cert.nombre}</h3>
                        <span className="border-borde-fuerte bg-panel text-texto-suave rounded-full border px-2 py-0.5 text-[11px] font-medium">
                          {def.etiquetaTarjeta}
                        </span>
                      </div>

                      {urlFinal && (
                        <a
                          href={urlFinal}
                          target="_blank"
                          rel="noreferrer"
                          className="focus-visible:ring-foco text-brand-fuerte inline-flex shrink-0 items-center gap-1 text-xs font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {etiquetaEnlace}
                          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    <p className="text-texto-suave text-xs">
                      {cert.norma} · {cert.emisor}
                      {fechaTexto ? ` · ${fechaTexto}` : ''}
                    </p>

                    {cert.observaciones && (
                      <p className="text-texto-tenue text-xs leading-relaxed">
                        {cert.observaciones}
                      </p>
                    )}
                  </div>

                  <div className="border-borde flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs">
                    <span className="text-texto-tenue">Hash SHA-256:</span>
                    {cert.doc_hash ? (
                      <CopiaHash valor={cert.doc_hash} />
                    ) : (
                      <span className="text-texto-tenue font-mono text-xs">PDF pendiente</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {permitirEdicion && (
          <details className="rounded-tarjeta border-borde bg-panel-elevado/30 border px-4 py-3">
            <summary className="text-texto-suave hover:text-texto cursor-pointer text-xs font-semibold transition-colors">
              + Declarar o actualizar certificación comercial (Productor / Veterinario)
            </summary>

            <div className="mt-4">
              {!puedeEditar ? (
                <BannerRolRequerido
                  rolRequerido="PRODUCTOR"
                  titulo="Carga reservada al Productor o Veterinario acreditado"
                  descripcion="Para declarar una certificación comercial voluntaria o adjuntar el informe PDF de Sinergia Medio Ambiente, ingresá como Productor o Veterinario."
                  userActual={userActual ?? null}
                  redirectTo={`/lotes/${codigoLote}`}
                />
              ) : (
                <form action={registrarCertificacionComercialAction} className="space-y-4">
                  <input type="hidden" name="codigo" value={codigoLote} />
                  <input
                    type="hidden"
                    name="usar_demo_pdf"
                    value={usarDemoPdf ? 'true' : 'false'}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={claseLabel} htmlFor="codigo_certificacion">
                        Certificación comercial *
                      </label>
                      <select
                        id="codigo_certificacion"
                        name="codigo_certificacion"
                        className={claseInput}
                        value={codigoSeleccionado}
                        onChange={(e) =>
                          cambiarCertificacion(e.target.value as CodigoCertificacionComercial)
                        }
                      >
                        {CERTIFICACIONES_COMERCIALES.map((item) => (
                          <option key={item.codigo} value={item.codigo}>
                            {item.nombre}
                          </option>
                        ))}
                      </select>
                      <p className="text-texto-tenue mt-1 text-xs">
                        Norma aplicable: {defSeleccionada.norma}
                      </p>
                    </div>

                    <div>
                      <label className={claseLabel} htmlFor="emisor">
                        Entidad medidora / certificadora *
                      </label>
                      <input
                        id="emisor"
                        name="emisor"
                        required
                        className={claseInput}
                        value={emisor}
                        onChange={(e) => setEmisor(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className={claseLabel} htmlFor="fecha_emision">
                        Fecha de emisión / medición
                      </label>
                      <input
                        id="fecha_emision"
                        name="fecha_emision"
                        type="date"
                        className={claseInput}
                        defaultValue={
                          existenteSeleccionada?.fecha_emision ??
                          new Date().toISOString().slice(0, 10)
                        }
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={claseLabel} htmlFor="observaciones">
                        Alcance / plan de manejo
                      </label>
                      <input
                        id="observaciones"
                        name="observaciones"
                        className={claseInput}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={claseLabel} htmlFor="cert_pdf">
                      Informe o certificado en PDF (se calcula su hash SHA-256)
                    </label>
                    <input
                      ref={fileRef}
                      id="cert_pdf"
                      name="cert_pdf"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className={claseInput}
                      onChange={() => setUsarDemoPdf(false)}
                    />
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void cargarPdfDemoSeleccionado()}
                        className="focus-visible:ring-foco text-brand-fuerte text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        Usar PDF demo ({defSeleccionada.demoPdfNombre})
                      </button>
                      {usarDemoPdf && (
                        <span className="text-texto-suave inline-flex items-center gap-1 text-xs">
                          <Check aria-hidden="true" strokeWidth={3} className="h-3.5 w-3.5" />
                          PDF demo listo ({defSeleccionada.demoPdfNombre})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Boton type="submit">Guardar certificación voluntaria</Boton>
                  </div>
                </form>
              )}
            </div>
          </details>
        )}
      </div>
    </Tarjeta>
  );
}
