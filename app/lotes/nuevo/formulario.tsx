'use client';

import dynamic from 'next/dynamic';
import { useActionState, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { crearLoteAction, type FormState } from '@/lib/actions';
import { parsePesadasCsv, resumenPesadas } from '@/lib/csv';
import { CATEGORIAS, MONEDAS, RAZAS, TIPOS_OPERACION, TIPOS_RODEO } from '@/lib/domain';
import { parseAndValidatePolygon } from '@/lib/geo';
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
  'w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-brand focus:outline-none';
const claseLabel = 'mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400';

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
    <form action={formAction} className="mt-8 space-y-8">
      {state.errors.length > 0 && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          <p className="font-semibold">No se pudo completar el Paso 1:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {state.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-6">
        <h2 className="text-lg font-semibold">Bloque 1 — Origen, documentación y trazabilidad</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
              Wallet Stellar (G... opcional)
            </label>
            <input
              id="productor_wallet"
              name="productor_wallet"
              className={claseInput}
              placeholder="G... (por defecto usa la wallet admin)"
              defaultValue={user?.wallet ?? 'GDEMO-PRODUCTOR'}
            />
            <p className="mt-1 text-xs text-stone-500">
              Si no contás con una wallet Stellar, se usará la wallet del sistema para registrar el
              lote.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={claseLabel} htmlFor="renspa">
              RENSPA *
            </label>
            <input
              id="renspa"
              name="renspa"
              required
              className={claseInput}
              placeholder="05.077.0.00412/00"
              defaultValue="05.077.0.00412/00"
            />
          </div>
          <div>
            <label className={claseLabel} htmlFor="provincia">
              Provincia *
            </label>
            <input
              id="provincia"
              name="provincia"
              required
              className={claseInput}
              defaultValue="Corrientes"
            />
          </div>
          <div>
            <label className={claseLabel} htmlFor="localidad">
              Localidad *
            </label>
            <input
              id="localidad"
              name="localidad"
              required
              className={claseInput}
              defaultValue="Mercedes"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={claseLabel} htmlFor="renspa_pdf">
              Constancia RENSPA (PDF/imagen) *
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
              className="text-brand hover:text-brand/80 mt-1 text-xs"
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
          <div>
            <label className={claseLabel} htmlFor="boleto_marca_pdf">
              Boleto de Marca y Señal (opcional)
            </label>
            <input
              id="boleto_marca_pdf"
              name="boleto_marca_pdf"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className={claseInput}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
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

        <div className="mt-6">
          <p className={claseLabel}>Polígono del establecimiento *</p>
          <p className="text-xs text-neutral-500">
            Activá <span className="text-neutral-300">Dibujar polígono</span> y hacé clic en el mapa
            satelital (mínimo 3 vértices); después{' '}
            <span className="text-neutral-300">Guardar polígono</span>. También podés pegar un
            GeoJSON o cargar un archivo. Se valida el cierre y se calcula la superficie.
          </p>
          <div className="mt-2">
            <MapaDibujo
              puntos={puntosMapa}
              activo={dibujo.activo}
              onAgregar={(punto) => setDibujo((estado) => agregarPunto(estado, punto))}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={dibujo.activo}
              disabled={dibujo.activo}
              className={`rounded border px-3 py-1.5 text-xs ${
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
              className="border-brand bg-brand hover:bg-brand/90 rounded border px-3 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-40"
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
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-40 disabled:hover:border-neutral-700"
              onClick={() => setDibujo((estado) => deshacerPunto(estado))}
            >
              Deshacer último punto
            </button>
            {dibujo.activo && (
              <button
                type="button"
                className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500"
                onClick={() => setDibujo(cancelarDibujo())}
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500"
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
            <button
              type="button"
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500"
              onClick={() => {
                setPoligonoTexto('');
                setDibujo(cancelarDibujo());
              }}
            >
              Limpiar dibujo
            </button>
            {geo && (
              <span className={geo.ok ? 'text-brand text-xs' : 'text-xs text-red-400'}>
                {geo.ok ? `Polígono válido — ${geo.superficieHa} ha` : geo.errors.join(' · ')}
              </span>
            )}
          </div>
          {dibujo.activo && (
            <p
              className={`mt-1 text-xs ${
                dibujo.borrador.length >= MIN_VERTICES ? 'text-brand' : 'text-neutral-400'
              }`}
            >
              {dibujo.borrador.length >= MIN_VERTICES
                ? `${dibujo.borrador.length} vértices — listo para guardar`
                : `Necesitás al menos ${MIN_VERTICES} vértices para guardar (llevás ${dibujo.borrador.length})`}
            </p>
          )}
          <textarea
            className={`${claseInput} mt-2 h-24 font-mono text-xs disabled:opacity-60`}
            placeholder='{"type":"Polygon","coordinates":[[[-58.04,-29.16],...]]}'
            value={poligonoTexto}
            disabled={dibujo.activo}
            onChange={(event) => setPoligonoTexto(event.target.value)}
          />
          <input type="hidden" name="poligono" value={poligonoTexto} />
        </div>

        <div className="mt-6">
          <label className={claseLabel} htmlFor="archivo_rfid_csv">
            CSV del bastón lector (caravana_rfid,peso_kg) *
          </label>
          <input
            ref={csvRef}
            id="archivo_rfid_csv"
            name="archivo_rfid_csv"
            type="file"
            accept=".csv,text/csv"
            className={claseInput}
            onChange={(event) => void onCsvChange(event)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="text-brand hover:text-brand/80 mt-1 text-xs"
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
              ✨ Generar caravanas únicas nuevas
            </button>
          </div>
          {csvInfo && (
            <div className="mt-2 rounded border border-neutral-800 bg-neutral-900 p-3 text-xs">
              {csvInfo.errors.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-4 text-red-400">
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
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-6">
        <h2 className="text-lg font-semibold">Bloque 2 — Caracterización del lote</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
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

      <section className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-6">
        <h2 className="text-lg font-semibold">Bloque 3 — Condiciones comerciales y financiación</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
              className={claseInput}
              defaultValue={10000}
            />
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
              className={claseInput}
              defaultValue={460}
            />
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
              className={claseInput}
              defaultValue={8}
            />
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
              className={claseInput}
              defaultValue="2026-12-31"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={claseLabel} htmlFor="descripcionOperacion">
            Descripción de la operación *
          </label>
          <textarea
            id="descripcionOperacion"
            name="descripcionOperacion"
            required
            className={`${claseInput} h-24`}
            defaultValue="Tropa de 30 terneros Braford para recría y engorde a pastura con suplementación, objetivo 460 kg en 8 meses."
          />
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand hover:bg-brand/90 rounded-md px-5 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-50"
        >
          {pending ? 'Validando EUDR y registrando Sello 1…' : 'Enviar lote y validar EUDR'}
        </button>
        <p className="text-xs text-neutral-500">
          Se consulta Global Forest Watch real y se calculan los hashes SHA-256 antes de registrar
          el Sello 1 en el contrato (modo demo sobre Stellar testnet).
        </p>
      </div>
    </form>
  );
}
