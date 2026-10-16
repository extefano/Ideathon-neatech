'use client';

import dynamic from 'next/dynamic';
import { useActionState, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Aviso } from '@/components/ui/aviso';
import { Boton } from '@/components/ui/boton';
import { Pasos, type Paso } from '@/components/ui/pasos';
import { crearLoteAction, type FormState } from '@/lib/actions';
import { parsePesadasCsv, resumenPesadas } from '@/lib/csv';
import { CATEGORIAS, MONEDAS, RAZAS, TIPOS_OPERACION, TIPOS_RODEO } from '@/lib/domain';
import { parseAndValidatePolygon } from '@/lib/geo';
import { validarEtapa, type ErroresEtapa } from './etapas';
import {
  ESTADO_DIBUJO_INICIAL,
  MIN_VERTICES,
  activarDibujo,
  agregarPunto,
  cancelarDibujo,
  deshacerPunto,
  guardarDibujo,
  puedeGuardar,
  puntosDesdePoligono,
  puntosVisibles,
  type EstadoDibujo,
} from './dibujo';

import type { PerfilUsuario } from '@/lib/auth';

const MapaDibujo = dynamic(() => import('./mapa-dibujo'), {
  ssr: false,
  loading: () => <div className="h-80 rounded-md border border-neutral-700 bg-neutral-900" />,
});

const claseInput =
  'w-full rounded-control border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus-visible:border-brand focus-visible:outline-none min-h-11';
const claseInputError =
  'w-full rounded-control border border-red-500/60 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus-visible:border-brand focus-visible:outline-none min-h-11';
const claseLabel = 'mb-1 block text-xs font-semibold tracking-wide text-neutral-400 uppercase';

const PASOS: Paso[] = [
  { titulo: 'Origen', descripcion: 'Establecimiento y polígono' },
  { titulo: 'Ganado', descripcion: 'Caravanas RFID' },
  { titulo: 'Documentos', descripcion: 'Marca y señales' },
  { titulo: 'Condiciones', descripcion: 'Precio y revisión' },
];

type CsvInfo = {
  rows: number;
  promedio: number;
  min: number;
  max: number;
  uniformidad: string;
  errors: string[];
};

export function FormularioLote({ user }: { user?: PerfilUsuario } = {}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(crearLoteAction, {
    errors: [],
  });

  const formRef = useRef<HTMLFormElement>(null);
  const [etapa, setEtapa] = useState(0);
  const [erroresEtapa, setErroresEtapa] = useState<ErroresEtapa>({});

  const [poligonoTexto, setPoligonoTexto] = useState('');
  const [dibujo, setDibujo] = useState<EstadoDibujo>(ESTADO_DIBUJO_INICIAL);
  const [csvInfo, setCsvInfo] = useState<CsvInfo | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const renspaRef = useRef<HTMLInputElement>(null);

  const geo = useMemo(
    () => (poligonoTexto ? parseAndValidatePolygon(poligonoTexto) : null),
    [poligonoTexto],
  );
  const puntosGuardados = useMemo(() => puntosDesdePoligono(poligonoTexto), [poligonoTexto]);
  const puntosMapa = puntosVisibles(dibujo, puntosGuardados);

  function valor(name: string): string {
    const elemento = formRef.current?.elements.namedItem(name);
    if (elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement) {
      return elemento.value.trim();
    }
    if (elemento instanceof HTMLSelectElement) return elemento.value.trim();
    return '';
  }

  function archivoSeleccionado(name: string): boolean {
    const elemento = formRef.current?.elements.namedItem(name);
    return elemento instanceof HTMLInputElement && (elemento.files?.length ?? 0) > 0;
  }

  function validarEtapaActual(): ErroresEtapa {
    return validarEtapa(etapa, {
      renspa: valor('renspa'),
      provincia: valor('provincia'),
      localidad: valor('localidad'),
      poligonoOk: Boolean(geo?.ok),
      archivoCsv: archivoSeleccionado('archivo_rfid_csv'),
      csvOk: Boolean(csvInfo && csvInfo.errors.length === 0 && csvInfo.rows > 0),
      monto: valor('montoTotalFinanciacion'),
      pesoObjetivo: valor('pesoObjetivoKg'),
      plazo: valor('plazoMeses'),
      fechaVigencia: valor('fechaVigencia'),
      descripcion: valor('descripcionOperacion'),
    });
  }

  function avanzar() {
    const errores = validarEtapaActual();
    setErroresEtapa(errores);
    if (Object.keys(errores).length === 0) setEtapa((actual) => Math.min(actual + 1, 3));
  }

  function retroceder() {
    setErroresEtapa({});
    setEtapa((actual) => Math.max(actual - 1, 0));
  }

  async function inspeccionarCsv(file: File) {
    const text = await file.text();
    const parsed = parsePesadasCsv(text);
    if (parsed.errors.length > 0) {
      setCsvInfo({
        rows: 0,
        promedio: 0,
        min: 0,
        max: 0,
        uniformidad: '—',
        errors: parsed.errors.slice(0, 8),
      });
      return;
    }
    const r = resumenPesadas(parsed.rows);
    setCsvInfo({
      rows: r.cantidad,
      promedio: r.promedioKg,
      min: r.minKg,
      max: r.maxKg,
      uniformidad: r.uniformidad,
      errors: [],
    });
  }

  async function onCsvChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setCsvInfo(null);
      return;
    }
    await inspeccionarCsv(file);
  }

  async function cargarArchivoDemo(
    inputRef: { current: HTMLInputElement | null },
    url: string,
    nombre: string,
    tipo: string,
    despues?: (file: File) => Promise<void>,
  ) {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], nombre, { type: tipo });
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
    }
    if (despues) await despues(file);
  }

  async function generarCaravanasUnicasDemo() {
    const prefijo = Date.now().toString().slice(-6);
    const lineas = ['caravana_rfid,peso_kg'];
    for (let i = 1; i <= 30; i++) {
      const rfid = `032${prefijo}${String(i).padStart(6, '0')}`;
      const peso = Math.round(195 + Math.random() * 15);
      lineas.push(`${rfid},${peso}`);
    }
    const blob = new Blob([lineas.join('\n')], { type: 'text/csv' });
    const file = new File([blob], `pesadas-demo-${prefijo}.csv`, { type: 'text/csv' });
    if (csvRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      csvRef.current.files = dt.files;
    }
    await inspeccionarCsv(file);
  }

  return (
    <form ref={formRef} action={formAction} className="mt-8 space-y-6" noValidate>
      <Pasos pasos={PASOS} actual={etapa} />

      {state.errors.length > 0 && (
        <Aviso variante="error" titulo="No se pudo registrar el lote">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {state.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Aviso>
      )}

      {Object.keys(erroresEtapa).length > 0 && (
        <Aviso variante="error" titulo="Revisá esta etapa antes de continuar">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {Object.values(erroresEtapa).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Aviso>
      )}

      {/* Etapa 1 — Establecimiento y origen */}
      <section className={etapa === 0 ? 'space-y-4' : 'hidden'}>
        <h2 className="text-lg font-semibold">1. Establecimiento y origen</h2>
        <p className="text-sm text-neutral-400">
          Datos del campo, constancia RENSPA y el polígono que se valida contra deforestación.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={claseLabel} htmlFor="productor_nombre">
              Productor (razón social)
            </label>
            <input
              id="productor_nombre"
              name="productor_nombre"
              className={claseInput}
              placeholder="Estancia La Esperanza SA"
              defaultValue={user?.nombre_completo ?? ''}
            />
          </div>
          <div>
            <label className={claseLabel} htmlFor="productor_cuit">
              CUIT
            </label>
            <input
              id="productor_cuit"
              name="productor_cuit"
              className={claseInput}
              placeholder="30-71234567-8"
              defaultValue={user?.cuit ?? ''}
            />
          </div>
          <div>
            <label className={claseLabel} htmlFor="productor_wallet">
              Wallet Stellar (opcional)
            </label>
            <input
              id="productor_wallet"
              name="productor_wallet"
              className={claseInput}
              placeholder="G… (usa la wallet admin si se deja vacío)"
              defaultValue={user?.wallet ?? 'GDEMO-PRODUCTOR'}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={claseLabel} htmlFor="renspa">
              RENSPA *
            </label>
            <input
              id="renspa"
              name="renspa"
              required
              className={erroresEtapa.renspa ? claseInputError : claseInput}
              aria-invalid={erroresEtapa.renspa ? true : undefined}
              placeholder="05.077.0.00412/00"
              defaultValue="05.077.0.00412/00"
            />
            {erroresEtapa.renspa && (
              <p className="mt-1 text-xs text-red-300">{erroresEtapa.renspa}</p>
            )}
          </div>
          <div>
            <label className={claseLabel} htmlFor="provincia">
              Provincia *
            </label>
            <input
              id="provincia"
              name="provincia"
              required
              className={erroresEtapa.provincia ? claseInputError : claseInput}
              aria-invalid={erroresEtapa.provincia ? true : undefined}
              defaultValue="Corrientes"
            />
            {erroresEtapa.provincia && (
              <p className="mt-1 text-xs text-red-300">{erroresEtapa.provincia}</p>
            )}
          </div>
          <div>
            <label className={claseLabel} htmlFor="localidad">
              Localidad *
            </label>
            <input
              id="localidad"
              name="localidad"
              required
              className={erroresEtapa.localidad ? claseInputError : claseInput}
              aria-invalid={erroresEtapa.localidad ? true : undefined}
              defaultValue="Mercedes"
            />
            {erroresEtapa.localidad && (
              <p className="mt-1 text-xs text-red-300">{erroresEtapa.localidad}</p>
            )}
          </div>
        </div>

        <div>
          <label className={claseLabel} htmlFor="renspa_pdf">
            Constancia RENSPA (PDF/imagen)
          </label>
          <input
            ref={renspaRef}
            id="renspa_pdf"
            name="renspa_pdf"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className={claseInput}
          />
          <button
            type="button"
            className="text-brand mt-1 text-xs hover:underline"
            onClick={() =>
              void cargarArchivoDemo(
                renspaRef,
                '/demo/renspa-demo.pdf',
                'renspa-demo.pdf',
                'application/pdf',
              )
            }
          >
            Usar PDF de demo
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="marcaLiquida"
            name="marcaLiquida"
            type="checkbox"
            className="accent-brand h-4 w-4"
          />
          <label htmlFor="marcaLiquida" className="text-sm text-neutral-300">
            Marca líquida (todos los animales con la marca del vendedor)
          </label>
        </div>

        <div>
          <p className={claseLabel}>Polígono del establecimiento *</p>
          <p className="text-xs text-neutral-500">
            Activá <span className="text-neutral-300">Dibujar polígono</span> y hacé clic en el mapa
            satelital (mínimo 3 vértices); después{' '}
            <span className="text-neutral-300">Guardar polígono</span>. También podés pegar un
            GeoJSON o cargar el de demo.
          </p>
          {etapa === 0 && (
            <div className="mt-2">
              <MapaDibujo
                puntos={puntosMapa}
                activo={dibujo.activo}
                onAgregar={(punto) => setDibujo((estado) => agregarPunto(estado, punto))}
              />
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={dibujo.activo}
              disabled={dibujo.activo}
              className={`rounded-control focus-visible:ring-foco border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none ${
                dibujo.activo
                  ? 'border-brand bg-brand/15 text-brand font-semibold'
                  : 'border-neutral-700 text-neutral-200 hover:border-neutral-500'
              }`}
              onClick={() => setDibujo(activarDibujo(puntosGuardados))}
            >
              {dibujo.activo ? 'Dibujando…' : 'Dibujar polígono'}
            </button>
            <button
              type="button"
              disabled={!puedeGuardar(dibujo)}
              className="rounded-control focus-visible:ring-foco border-brand bg-brand border px-3 py-1.5 text-xs font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
              onClick={() => {
                const resultado = guardarDibujo(dibujo);
                if (resultado.poligono) setPoligonoTexto(resultado.poligono);
                setDibujo(resultado.estado);
              }}
            >
              Guardar polígono
            </button>
            <button
              type="button"
              disabled={!dibujo.activo || dibujo.borrador.length === 0}
              className="rounded-control focus-visible:ring-foco border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
              onClick={() => setDibujo((estado) => deshacerPunto(estado))}
            >
              Deshacer último punto
            </button>
            {dibujo.activo && (
              <button
                type="button"
                className="rounded-control focus-visible:ring-foco border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 focus-visible:ring-2 focus-visible:outline-none"
                onClick={() => setDibujo(cancelarDibujo())}
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              className="rounded-control focus-visible:ring-foco border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 focus-visible:ring-2 focus-visible:outline-none"
              onClick={() =>
                void fetch('/demo/poligono.geojson')
                  .then((r) => r.text())
                  .then((texto) => {
                    setPoligonoTexto(texto);
                    setDibujo(cancelarDibujo());
                  })
              }
            >
              Usar polígono de demo
            </button>
            {puntosGuardados.length > 0 && (
              <button
                type="button"
                className="rounded-control focus-visible:ring-foco border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 focus-visible:ring-2 focus-visible:outline-none"
                onClick={() => {
                  setPoligonoTexto('');
                  setDibujo(cancelarDibujo());
                }}
              >
                Limpiar
              </button>
            )}
            {geo && (
              <span className={geo.ok ? 'text-brand text-xs' : 'text-xs text-red-300'}>
                {geo.ok ? `Polígono válido — ${geo.superficieHa} ha` : geo.errors.join(' · ')}
              </span>
            )}
          </div>
          {dibujo.activo && (
            <p
              className={`mt-1 text-xs ${dibujo.borrador.length >= MIN_VERTICES ? 'text-brand' : 'text-neutral-400'}`}
            >
              {dibujo.borrador.length >= MIN_VERTICES
                ? `${dibujo.borrador.length} vértices — listo para guardar`
                : `Necesitás al menos ${MIN_VERTICES} vértices (llevás ${dibujo.borrador.length})`}
            </p>
          )}
          <textarea
            className={`${claseInput} mt-2 h-24 font-mono text-xs disabled:opacity-60`}
            aria-label="GeoJSON del polígono"
            placeholder='{"type":"Polygon","coordinates":[[[-58.04,-29.16],…]]}'
            value={poligonoTexto}
            disabled={dibujo.activo}
            onChange={(event) => setPoligonoTexto(event.target.value)}
          />
          <input type="hidden" name="poligono" value={poligonoTexto} />
          {erroresEtapa.poligono && (
            <p className="mt-1 text-xs text-red-300">{erroresEtapa.poligono}</p>
          )}
        </div>
      </section>

      {/* Etapa 2 — Ganado */}
      <section className={etapa === 1 ? 'space-y-4' : 'hidden'}>
        <h2 className="text-lg font-semibold">2. Ganado</h2>
        <p className="text-sm text-neutral-400">
          Cargá las caravanas RFID del bastón lector y caracterizá el lote.
        </p>

        <div>
          <label className={claseLabel} htmlFor="archivo_rfid_csv">
            CSV del bastón lector (caravana_rfid,peso_kg) *
          </label>
          <input
            ref={csvRef}
            id="archivo_rfid_csv"
            name="archivo_rfid_csv"
            type="file"
            accept=".csv,text/csv"
            className={erroresEtapa.archivo_rfid_csv ? claseInputError : claseInput}
            aria-invalid={erroresEtapa.archivo_rfid_csv ? true : undefined}
            onChange={(event) => void onCsvChange(event)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="text-brand mt-1 text-xs hover:underline"
              onClick={() =>
                void cargarArchivoDemo(
                  csvRef,
                  '/demo/pesadas-inicial.csv',
                  'pesadas-inicial.csv',
                  'text/csv',
                  inspeccionarCsv,
                )
              }
            >
              Usar CSV de demo (30 cabezas ~200 kg)
            </button>
            <span className="text-xs text-neutral-600">·</span>
            <button
              type="button"
              className="mt-1 text-xs text-neutral-300 hover:text-white"
              onClick={() => void generarCaravanasUnicasDemo()}
            >
              Generar caravanas únicas nuevas
            </button>
          </div>
          {csvInfo && (
            <div className="mt-2 rounded border border-neutral-800 bg-neutral-900 p-3 text-xs">
              {csvInfo.errors.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-4 text-red-300">
                  {csvInfo.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-neutral-300">
                  {csvInfo.rows} cabezas · promedio {csvInfo.promedio} kg · rango {csvInfo.min}–
                  {csvInfo.max} kg · <span className="text-brand">{csvInfo.uniformidad}</span>
                </p>
              )}
            </div>
          )}
          {erroresEtapa.archivo_rfid_csv && (
            <p className="mt-1 text-xs text-red-300">{erroresEtapa.archivo_rfid_csv}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={claseLabel} htmlFor="tipoOperacion">
              Tipo de operación *
            </label>
            <select
              id="tipoOperacion"
              name="tipoOperacion"
              className={claseInput}
              defaultValue="Recría"
            >
              {TIPOS_OPERACION.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={claseLabel} htmlFor="categoria">
              Categoría *
            </label>
            <select id="categoria" name="categoria" className={claseInput} defaultValue="Terneros">
              {CATEGORIAS.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={claseLabel} htmlFor="raza">
              Raza *
            </label>
            <select id="raza" name="raza" className={claseInput} defaultValue="Braford">
              {RAZAS.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={claseLabel} htmlFor="tipoRodeo">
              Tipo de rodeo *
            </label>
            <select
              id="tipoRodeo"
              name="tipoRodeo"
              className={claseInput}
              defaultValue="Rodeo general"
            >
              {TIPOS_RODEO.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={claseLabel} htmlFor="edadMeses">
              Edad (meses)
            </label>
            <input
              id="edadMeses"
              name="edadMeses"
              type="number"
              min={1}
              className={claseInput}
              placeholder="8"
            />
          </div>
          <div>
            <label className={claseLabel} htmlFor="denticion">
              Dentición
            </label>
            <input
              id="denticion"
              name="denticion"
              className={claseInput}
              placeholder="Diente de leche"
            />
          </div>
          <div className="sm:col-span-3">
            <label className={claseLabel} htmlFor="tratamientoNutricional">
              Tratamiento nutricional
            </label>
            <input
              id="tratamientoNutricional"
              name="tratamientoNutricional"
              className={claseInput}
              placeholder="Pastura implantada + suplementación"
            />
          </div>
        </div>
      </section>

      {/* Etapa 3 — Documentos */}
      <section className={etapa === 2 ? 'space-y-4' : 'hidden'}>
        <h2 className="text-lg font-semibold">3. Documentos</h2>
        <p className="text-sm text-neutral-400">
          Adjuntá el boleto de marca y señal. Los hashes SHA-256 se calculan al enviar el
          formulario.
        </p>
        <div>
          <label className={claseLabel} htmlFor="boleto_marca_pdf">
            Boleto de marca y señal (opcional)
          </label>
          <input
            id="boleto_marca_pdf"
            name="boleto_marca_pdf"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className={claseInput}
          />
        </div>
        <Aviso variante="info">
          La constancia RENSPA se cargó en la etapa 1. Al enviar, cada documento se sella con su
          huella digital.
        </Aviso>
      </section>

      {/* Etapa 4 — Condiciones comerciales y revisión */}
      <section className={etapa === 3 ? 'space-y-4' : 'hidden'}>
        <h2 className="text-lg font-semibold">4. Condiciones comerciales y revisión</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={claseLabel} htmlFor="moneda">
              Moneda *
            </label>
            <select id="moneda" name="moneda" className={claseInput} defaultValue="USDC">
              {MONEDAS.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={claseLabel} htmlFor="montoTotalFinanciacion">
              Monto total a financiar *
            </label>
            <input
              id="montoTotalFinanciacion"
              name="montoTotalFinanciacion"
              type="number"
              min={1}
              required
              className={erroresEtapa.montoTotalFinanciacion ? claseInputError : claseInput}
              aria-invalid={erroresEtapa.montoTotalFinanciacion ? true : undefined}
              defaultValue={10000}
            />
            {erroresEtapa.montoTotalFinanciacion && (
              <p className="mt-1 text-xs text-red-300">{erroresEtapa.montoTotalFinanciacion}</p>
            )}
          </div>
          <div>
            <label className={claseLabel} htmlFor="pesoObjetivoKg">
              Peso objetivo (kg) *
            </label>
            <input
              id="pesoObjetivoKg"
              name="pesoObjetivoKg"
              type="number"
              min={100}
              max={900}
              required
              className={erroresEtapa.pesoObjetivoKg ? claseInputError : claseInput}
              aria-invalid={erroresEtapa.pesoObjetivoKg ? true : undefined}
              defaultValue={460}
            />
            {erroresEtapa.pesoObjetivoKg && (
              <p className="mt-1 text-xs text-red-300">{erroresEtapa.pesoObjetivoKg}</p>
            )}
          </div>
          <div>
            <label className={claseLabel} htmlFor="plazoMeses">
              Plazo (meses) *
            </label>
            <input
              id="plazoMeses"
              name="plazoMeses"
              type="number"
              min={1}
              max={36}
              required
              className={erroresEtapa.plazoMeses ? claseInputError : claseInput}
              aria-invalid={erroresEtapa.plazoMeses ? true : undefined}
              defaultValue={8}
            />
            {erroresEtapa.plazoMeses && (
              <p className="mt-1 text-xs text-red-300">{erroresEtapa.plazoMeses}</p>
            )}
          </div>
          <div>
            <label className={claseLabel} htmlFor="fechaVigencia">
              Vigencia de la oferta *
            </label>
            <input
              id="fechaVigencia"
              name="fechaVigencia"
              type="date"
              required
              className={erroresEtapa.fechaVigencia ? claseInputError : claseInput}
              aria-invalid={erroresEtapa.fechaVigencia ? true : undefined}
              defaultValue="2026-12-31"
            />
            {erroresEtapa.fechaVigencia && (
              <p className="mt-1 text-xs text-red-300">{erroresEtapa.fechaVigencia}</p>
            )}
          </div>
        </div>
        <div>
          <label className={claseLabel} htmlFor="descripcionOperacion">
            Descripción de la operación *
          </label>
          <textarea
            id="descripcionOperacion"
            name="descripcionOperacion"
            required
            className={`${erroresEtapa.descripcionOperacion ? claseInputError : claseInput} h-24`}
            aria-invalid={erroresEtapa.descripcionOperacion ? true : undefined}
            defaultValue="Tropa de 30 terneros Braford para recría y engorde a pastura con suplementación, objetivo 460 kg en 8 meses."
          />
          {erroresEtapa.descripcionOperacion && (
            <p className="mt-1 text-xs text-red-300">{erroresEtapa.descripcionOperacion}</p>
          )}
        </div>

        <Aviso variante="info" titulo="Resumen antes de enviar">
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Cabezas: {csvInfo ? `${csvInfo.rows} · promedio ${csvInfo.promedio} kg` : 'sin CSV'}
            </li>
            <li>Polígono: {geo?.ok ? `${geo.superficieHa} ha válidas` : 'sin validar'}</li>
            <li>
              Al enviar se consulta Global Forest Watch (corte 31/12/2020) y se registra el Sello 1.
            </li>
          </ul>
        </Aviso>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 pt-4">
        <Boton type="button" variante="secundario" onClick={retroceder} disabled={etapa === 0}>
          ← Atrás
        </Boton>

        {etapa < 3 ? (
          <Boton type="button" onClick={avanzar}>
            Siguiente →
          </Boton>
        ) : (
          <Boton type="submit" cargando={pending}>
            {pending ? 'Validando EUDR y registrando Sello 1…' : 'Enviar lote y validar EUDR'}
          </Boton>
        )}
      </div>
    </form>
  );
}
