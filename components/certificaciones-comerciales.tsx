'use client';

import { Check, ExternalLink } from 'lucide-react';
import { useRef, useState } from 'react';
import { BannerRolRequerido } from '@/components/auth-guard';
import { Aviso } from '@/components/ui/aviso';
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
      descripcion="Diferenciales de mercado para compradores e importadores (UE / Mercosur). No reemplazan los 3 sellos obligatorios de acceso aduanero (EUDR + SENASA)."
      acciones={
        <span className="border-borde-fuerte bg-panel-elevado text-texto rounded border px-2.5 py-1 font-mono text-xs">
          Eje 2 · Voluntario UE / Mercosur
        </span>
      }
    >
      <div className="space-y-4">
        <div className="rounded-tarjeta border-borde bg-panel-elevado/60 text-texto-suave border p-3.5 text-xs">
          <p className="text-texto font-semibold">
            Separación entre acceso aduanero (Eje 1) y valor comercial en góndola (Eje 2)
          </p>
          <p className="text-texto-suave mt-1 leading-relaxed">
            El <strong>Eje 1 (Obligatorio)</strong> resuelve la identidad animal (Caravana RFID), el
            movimiento sanitario oficial (<code className="font-mono">RENSPA</code> y{' '}
            <code className="font-mono">DT-e</code> de SENASA) y el mapa libre de deforestación post
            31/12/2020 (GFW). El <strong>Eje 2 (Voluntario)</strong> suma mediciones privadas e
            independientes —como el inventario biológico de huella GEI y plan de mitigación de{' '}
            <strong>Sinergia Medio Ambiente</strong> (ISO 14064 / ISO 14067),{' '}
            <strong>Bienestar Animal (Welfair / ITW)</strong> y{' '}
            <strong>Libre de Antibióticos y Hormonas</strong>— que actúan como filtros de compra y
            habilitan sobreprecio comercial.
          </p>
        </div>

        {certificaciones.length === 0 ? (
          <Aviso variante="info" titulo="Sin certificaciones comerciales voluntarias declaradas">
            Este lote cuenta con su trazabilidad obligatoria EUDR (Eje 1), pero todavía no tiene
            certificados voluntarios del Eje 2 asociados (Huella GEI · Sinergia Medio Ambiente,
            Bienestar Animal o Libre de Antibióticos).
          </Aviso>
        ) : (
          <ul className="space-y-3" aria-label="Certificaciones comerciales del lote">
            {certificaciones.map((cert) => {
              const def = obtenerDefinicionCertificacion(cert.codigo);
              const urlFinal = cert.docUrlResuelta ?? cert.doc_url ?? null;
              const fechaTexto = formatearFecha(cert.fecha_emision);
              const etiquetaEnlace =
                cert.codigo === 'HUELLA_CARBONO_SINERGIA' ? 'Ver informe PDF' : 'Ver certificado';

              return (
                <li key={cert.codigo} className="rounded-tarjeta border-borde bg-panel border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="border-brand-fuerte/50 bg-brand/10 text-brand-fuerte inline-flex h-5 w-5 items-center justify-center rounded-full border">
                          <Check aria-hidden="true" strokeWidth={3} className="h-3 w-3" />
                        </span>
                        <h3 className="text-texto text-sm font-semibold">{cert.nombre}</h3>
                        <span className="border-borde-fuerte bg-panel-elevado text-texto-suave rounded border px-2 py-0.5 font-mono text-[10px]">
                          {def.etiquetaTarjeta}
                        </span>
                      </div>

                      <p className="text-texto text-xs">
                        <span className="text-texto-suave">Norma:</span> {cert.norma} ·{' '}
                        <span className="text-texto-suave">Emisor / Auditor:</span> {cert.emisor}
                        {fechaTexto ? ` · Emitido: ${fechaTexto}` : ''}
                      </p>

                      {cert.observaciones && (
                        <p className="text-texto-suave text-xs">
                          <span className="text-texto font-medium">Detalle:</span>{' '}
                          {cert.observaciones}
                        </p>
                      )}

                      <p className="text-texto-tenue text-[11px]">{def.rolTecnico}</p>
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

                  <div className="border-borde mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs">
                    <span className="text-texto-suave">
                      Respaldo documental (huella SHA-256 verificable):
                    </span>
                    {cert.doc_hash ? (
                      <CopiaHash valor={cert.doc_hash} />
                    ) : (
                      <span className="text-texto-tenue font-mono text-xs">
                        Declaración registrada · PDF pendiente de adjuntar
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {permitirEdicion && (
          <details className="rounded-tarjeta border-borde bg-panel-elevado/40 border p-4">
            <summary className="text-texto cursor-pointer text-sm font-semibold">
              Agregar o actualizar respaldo documental de certificación (Productor / Veterinario)
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
                        Certificación comercial (Eje 2) *
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
