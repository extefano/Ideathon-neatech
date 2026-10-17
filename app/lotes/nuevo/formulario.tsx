'use client';

import dynamic from 'next/dynamic';
import {
  useActionState,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Aviso } from '@/components/ui/aviso';
import { Boton } from '@/components/ui/boton';
import { Pasos, type Paso } from '@/components/ui/pasos';
import { PorcentajeHumedal } from '@/components/porcentaje-humedal';
import { crearLoteAction, type FormState } from '@/lib/actions';
import { parsePesadasCsv, resumenPesadas } from '@/lib/csv';
import {
  CATEGORIAS,
  CERTIFICACIONES_COMERCIALES,
  MONEDAS,
  PESO_MAX_KG,
  PESO_MIN_KG,
  RAZAS,
  TIPOS_OPERACION,
  TIPOS_RODEO,
  type CodigoCertificacionComercial,
} from '@/lib/domain';
import { parseAndValidatePolygon } from '@/lib/geo';
import { descripcionHumedal } from '@/lib/humedales';
import { validarEtapa, type ErroresEtapa } from './etapas';
import { crearControladorHumedal, type EstadoAnalisisHumedal } from './humedal-estado';
import { guardarPoligonoAction } from './humedal-action';
import {
  ESTADO_DIBUJO_INICIAL,
  MIN_VERTICES,
  activarDibujo,
  agregarPunto,
  cancelarDibujo,
  deshacerPunto,
  guardarDibujo,
  poligonoTieneAgujeros,
  puedeGuardar,
  puntosDesdePoligono,
  puntosVisibles,
  type EstadoDibujo,
} from './dibujo';

import type { PerfilUsuario } from '@/lib/auth';
import { ConnectWallet, type EstadoWalletConectada } from '@/components/connect-wallet';
import { esWalletStellar } from '@/lib/stellar-args';

const MapaDibujo = dynamic(() => import('./mapa-dibujo'), {
  ssr: false,
  loading: () => <div className="border-borde-fuerte bg-panel h-80 rounded-md border" />,
});

const claseInput =
  'w-full rounded-control border border-borde-fuerte bg-panel px-3 py-2 text-sm text-texto focus-visible:border-brand-fuerte focus-visible:outline-none min-h-11';
const claseInputError =
  'w-full rounded-control border border-red-600/60 bg-panel px-3 py-2 text-sm text-texto focus-visible:border-brand-fuerte focus-visible:outline-none min-h-11';
const claseLabel = 'mb-1 block text-xs font-semibold tracking-wide text-texto-suave uppercase';

const PASOS: Paso[] = [
  { titulo: 'Origen', descripcion: 'Establecimiento y polígono' },
  { titulo: 'Ganado', descripcion: 'Caravanas RFID' },
  { titulo: 'Documentos', descripcion: 'Marca y certificaciones' },
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

  const walletInicial = user?.wallet && esWalletStellar(user.wallet) ? user.wallet : '';
  const [walletState, setWalletState] = useState<EstadoWalletConectada | null>(
    walletInicial
      ? { address: walletInicial, network: 'TESTNET', esTestnet: true, metodo: 'extension' }
      : null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [etapa, setEtapa] = useState(0);
  const [erroresEtapa, setErroresEtapa] = useState<ErroresEtapa>({});
  const [poligonoTexto, setPoligonoTexto] = useState('');
  const [dibujo, setDibujo] = useState<EstadoDibujo>(ESTADO_DIBUJO_INICIAL);
  const [csvInfo, setCsvInfo] = useState<CsvInfo | null>(null);
  const [certsActivas, setCertsActivas] = useState<Record<CodigoCertificacionComercial, boolean>>({
    HUELLA_CARBONO_SINERGIA: false,
    BIENESTAR_ANIMAL: false,
    LIBRE_ANTIBIOTICOS_HORMONAS: false,
  });
  const [certsUsarDemo, setCertsUsarDemo] = useState<Record<CodigoCertificacionComercial, boolean>>(
    {
      HUELLA_CARBONO_SINERGIA: false,
      BIENESTAR_ANIMAL: false,
      LIBRE_ANTIBIOTICOS_HORMONAS: false,
    },
  );
  const [csvNombre, setCsvNombre] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const renspaRef = useRef<HTMLInputElement>(null);
  const [humedal, setHumedal] = useState<EstadoAnalisisHumedal>({ fase: 'vacio' });
  const [analizandoEnvio, setAnalizandoEnvio] = useState(false);
  const [errorDemo, setErrorDemo] = useState<string | null>(null);
  const [verificacionId, setVerificacionId] = useState('');
  const [creacionKey, setCreacionKey] = useState('');
  const [controlHumedal] = useState(() => crearControladorHumedal(setHumedal));
  const tokenCargaDemoRef = useRef(0);

  const geo = useMemo(
    () => (poligonoTexto ? parseAndValidatePolygon(poligonoTexto) : null),
    [poligonoTexto],
  );
  const puntosGuardados = useMemo(() => puntosDesdePoligono(poligonoTexto), [poligonoTexto]);
  const puntosMapa = puntosVisibles(dibujo, puntosGuardados);
  const tieneAgujeros = useMemo(() => poligonoTieneAgujeros(poligonoTexto), [poligonoTexto]);
  const analisisVigente = humedal.fase === 'resultado' && humedal.geometria === poligonoTexto;
  const analizando =
    analizandoEnvio || (humedal.fase === 'analizando' && humedal.geometria === poligonoTexto);

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
      dibujoActivo: dibujo.activo,
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
    setCsvNombre(file.name);
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
      setCsvNombre(null);
      setCsvInfo(null);
      return;
    }
    await inspeccionarCsv(file);
  }

  /**
   * Cambia el polígono del formulario e invalida cualquier análisis o carga
   * demo en vuelo: una respuesta vieja nunca debe pisar esta edición.
   */
  function actualizarPoligono(texto: string) {
    tokenCargaDemoRef.current += 1;
    controlHumedal.invalidar();
    setVerificacionId('');
    setErrorDemo(null);
    setPoligonoTexto(texto);
  }

  async function analizarHumedal(poligono: string) {
    // Clave de idempotencia del alta: una sola por intento, generada antes del
    // envío para que el FormData del clic de confirmación ya la incluya.
    if (!creacionKey) setCreacionKey(crypto.randomUUID());
    const token = controlHumedal.iniciar(poligono);
    try {
      const resultado = await guardarPoligonoAction(poligono);
      if (controlHumedal.resolver(token, poligono, resultado)) {
        setVerificacionId(resultado.ok ? resultado.verificacionId : '');
      }
    } catch {
      if (
        controlHumedal.resolver(token, poligono, {
          ok: false,
          errores: ['No pudimos analizar el humedal. Revisá tu conexión y reintentá.'],
        })
      ) {
        setVerificacionId('');
      }
    }
  }

  /** Carga el polígono de demo sin pisar ediciones hechas mientras viaja. */
  async function cargarPoligonoDemo() {
    const token = (tokenCargaDemoRef.current += 1);
    setErrorDemo(null);
    try {
      const res = await fetch('/demo/poligono.geojson');
      if (!res.ok) throw new Error('Sin respuesta de demo');
      const texto = await res.text();
      if (tokenCargaDemoRef.current !== token) return;
      actualizarPoligono(texto);
      setDibujo(cancelarDibujo());
      void analizarHumedal(texto);
    } catch {
      if (tokenCargaDemoRef.current !== token) return;
      setErrorDemo('No se pudo cargar el polígono de demo. Reintentá o pegá el GeoJSON a mano.');
    }
  }

  async function alEnviar(event: ReactMouseEvent<HTMLButtonElement>) {
    if (dibujo.activo) {
      event.preventDefault();
      setErroresEtapa((actuales) => ({
        ...actuales,
        poligono: 'Terminá o guardá el dibujo del polígono antes de enviar.',
      }));
      return;
    }
    if (analizandoEnvio || analizando) {
      event.preventDefault();
      return;
    }
    const geoActual = poligonoTexto ? parseAndValidatePolygon(poligonoTexto) : null;
    if (!geoActual?.ok) {
      event.preventDefault();
      return;
    }

    // Gate de dos pasos: el resumen y la evidencia que se envían deben
    // corresponder al polígono visible y a un resultado ya revisado. Si no hay
    // resultado vigente, este clic solo analiza y muestra; el envío exige un
    // segundo clic explícito (nunca `requestSubmit()` automático).
    if (controlHumedal.geometriaVigente() !== poligonoTexto) {
      event.preventDefault();
      if (humedal.fase === 'analizando' && humedal.geometria === poligonoTexto) return;
      setAnalizandoEnvio(true);
      await analizarHumedal(poligonoTexto);
      setAnalizandoEnvio(false);
    }
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
        <p className="text-texto-suave text-sm">
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
              readOnly
              aria-describedby="productor_identidad_ayuda"
              className={`${claseInput} cursor-not-allowed opacity-70`}
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
              readOnly
              aria-describedby="productor_identidad_ayuda"
              className={`${claseInput} cursor-not-allowed opacity-70`}
              defaultValue={user?.cuit ?? ''}
            />
          </div>
          <div>
            <ConnectWallet
              name="productor_wallet"
              label="Wallet Stellar del productor *"
              initialAddress={walletInicial}
              onChange={(w) => setWalletState(w)}
            />
          </div>
        </div>
        <p id="productor_identidad_ayuda" className="text-xs text-neutral-400">
          El nombre y el CUIT se toman de tu cuenta; si necesitás cambiarlos, actualizá tu perfil.
        </p>

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
              <p className="mt-1 text-xs text-red-700">{erroresEtapa.renspa}</p>
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
              <p className="mt-1 text-xs text-red-700">{erroresEtapa.provincia}</p>
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
              <p className="mt-1 text-xs text-red-700">{erroresEtapa.localidad}</p>
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
            className="text-brand-fuerte mt-1 text-xs hover:underline"
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
          <label htmlFor="marcaLiquida" className="text-texto-suave text-sm">
            Marca líquida (todos los animales con la marca del vendedor)
          </label>
        </div>

        <div>
          <p className={claseLabel}>Polígono del establecimiento *</p>
          <p className="text-texto-tenue text-xs">
            Activá <span className="text-texto-suave">Dibujar polígono</span> y hacé clic en el mapa
            satelital (mínimo 3 vértices); después{' '}
            <span className="text-texto-suave">Guardar polígono</span>. También podés pegar un
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
              disabled={dibujo.activo || tieneAgujeros}
              aria-describedby={tieneAgujeros ? 'poligono-agujeros' : undefined}
              className={`rounded-control focus-visible:ring-foco border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40 ${
                dibujo.activo
                  ? 'border-brand-fuerte bg-brand/15 text-brand-fuerte font-semibold'
                  : 'border-borde-fuerte text-texto hover:border-texto-tenue'
              }`}
              onClick={() => setDibujo(activarDibujo(puntosGuardados))}
            >
              {dibujo.activo ? 'Dibujando…' : 'Dibujar polígono'}
            </button>
            <button
              type="button"
              disabled={!puedeGuardar(dibujo)}
              className="rounded-control focus-visible:ring-foco border-brand-fuerte bg-brand border px-3 py-1.5 text-xs font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
              onClick={() => {
                const resultado = guardarDibujo(dibujo);
                if (resultado.poligono) {
                  actualizarPoligono(resultado.poligono);
                  void analizarHumedal(resultado.poligono);
                }
                setDibujo(resultado.estado);
              }}
            >
              Guardar polígono
            </button>
            <button
              type="button"
              disabled={!dibujo.activo || dibujo.borrador.length === 0}
              className="rounded-control focus-visible:ring-foco border-borde-fuerte text-texto hover:border-texto-tenue border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
              onClick={() => setDibujo((estado) => deshacerPunto(estado))}
            >
              Deshacer último punto
            </button>
            {dibujo.activo && (
              <button
                type="button"
                className="rounded-control focus-visible:ring-foco border-borde-fuerte text-texto hover:border-texto-tenue border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
                onClick={() => setDibujo(cancelarDibujo())}
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              className="rounded-control focus-visible:ring-foco border-borde-fuerte text-texto hover:border-texto-tenue border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => void cargarPoligonoDemo()}
            >
              Usar polígono de demo
            </button>
            {puntosGuardados.length > 0 && (
              <button
                type="button"
                className="rounded-control focus-visible:ring-foco border-borde-fuerte text-texto hover:border-texto-tenue border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
                onClick={() => {
                  actualizarPoligono('');
                  setDibujo(cancelarDibujo());
                }}
              >
                Limpiar
              </button>
            )}
            {poligonoTexto &&
              geo?.ok &&
              !dibujo.activo &&
              (humedal.fase === 'vacio' || humedal.fase === 'error') && (
                <button
                  type="button"
                  className="rounded-control focus-visible:ring-foco border-brand text-brand border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                  onClick={() => void analizarHumedal(poligonoTexto)}
                >
                  Analizar humedal
                </button>
              )}
            {geo && (
              <span className={geo.ok ? 'text-brand-fuerte text-xs' : 'text-xs text-red-700'}>
                {geo.ok ? `Polígono válido — ${geo.superficieHa} ha` : geo.errors.join(' · ')}
              </span>
            )}
          </div>
          {tieneAgujeros && (
            <p id="poligono-agujeros" role="status" className="mt-1 text-xs text-neutral-300">
              Este polígono tiene agujeros (anillos interiores). El editor del mapa no los soporta:
              quitálos desde el GeoJSON para poder editarlo con “Dibujar polígono”.
            </p>
          )}
          {errorDemo && (
            <Aviso variante="error" className="mt-2">
              {errorDemo}
            </Aviso>
          )}
          {dibujo.activo && (
            <p
              className={`mt-1 text-xs ${dibujo.borrador.length >= MIN_VERTICES ? 'text-brand-fuerte' : 'text-texto-suave'}`}
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
            onChange={(event) => actualizarPoligono(event.target.value)}
          />
          <input type="hidden" name="poligono" value={poligonoTexto} readOnly />
          <input type="hidden" name="verificacion_humedal" value={verificacionId} readOnly />
          <input type="hidden" name="creacion_key" value={creacionKey} readOnly />
          {erroresEtapa.poligono && (
            <p className="mt-1 text-xs text-red-700">{erroresEtapa.poligono}</p>
          )}
          {humedal.fase === 'analizando' && (
            <p role="status" className="mt-2 text-xs text-neutral-300">
              Analizando humedales del polígono…
            </p>
          )}
          {humedal.fase === 'resultado' && <PorcentajeHumedal reporte={humedal.reporte} />}
          {humedal.fase === 'error' && (
            <Aviso variante="error" titulo="No pudimos analizar el humedal" className="mt-2">
              <ul className="list-disc space-y-1 pl-4">
                {humedal.errores.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </Aviso>
          )}
        </div>
      </section>

      {/* Etapa 2 — Ganado */}
      <section className={etapa === 1 ? 'space-y-4' : 'hidden'}>
        <h2 className="text-lg font-semibold">2. Ganado</h2>
        <p className="text-texto-suave text-sm">
          Cargá las caravanas RFID del bastón lector y caracterizá el lote.
        </p>

        <div>
          <p className={claseLabel}>CSV del bastón lector *</p>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <input
                ref={csvRef}
                id="archivo_rfid_csv"
                name="archivo_rfid_csv"
                type="file"
                accept=".csv,text/csv"
                className="peer sr-only"
                aria-describedby="csv_ayuda csv_archivo"
                aria-invalid={erroresEtapa.archivo_rfid_csv ? true : undefined}
                onChange={(event) => void onCsvChange(event)}
              />
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 text-neutral-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                  <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
                  <path d="M9 13h6M9 17h4" />
                </svg>
              </span>
              <div className="min-w-0 flex-1 basis-64">
                <p id="csv_ayuda" className="text-xs text-neutral-400">
                  Archivo .csv con encabezado{' '}
                  <code className="rounded bg-neutral-950 px-1 py-0.5 font-mono text-[11px] text-neutral-300">
                    caravana_rfid,peso_kg
                  </code>
                  . Una fila por animal; se validan caravanas de 15 dígitos (prefijo 032) y pesos
                  entre {PESO_MIN_KG} y {PESO_MAX_KG} kg.
                </p>
                <p
                  id="csv_archivo"
                  aria-live="polite"
                  className={`mt-1 truncate font-mono text-xs ${
                    csvNombre ? 'text-brand' : 'text-neutral-500'
                  }`}
                >
                  {csvNombre ?? 'Ningún archivo seleccionado'}
                </p>
              </div>
              <label
                htmlFor="archivo_rfid_csv"
                className="peer-focus-visible:ring-brand border-brand bg-brand hover:bg-brand/90 cursor-pointer rounded-md border px-4 py-2 text-xs font-semibold text-neutral-950 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-neutral-950"
              >
                Seleccionar archivo CSV
              </label>
            </div>
            {csvInfo && (
              <div className="mt-3 rounded border border-neutral-800 bg-neutral-950 p-3 text-xs">
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
          {erroresEtapa.archivo_rfid_csv && (
            <p className="mt-1 text-xs text-red-300">{erroresEtapa.archivo_rfid_csv}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs text-neutral-500">¿No tenés el archivo a mano?</span>
            <button
              type="button"
              className="text-brand-fuerte mt-1 text-xs hover:underline"
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
            <span className="text-texto-tenue text-xs">·</span>
            <button
              type="button"
              className="text-texto-suave hover:text-texto mt-1 text-xs"
              onClick={() => void generarCaravanasUnicasDemo()}
            >
              Generar caravanas únicas nuevas
            </button>
          </div>
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
        <h2 className="text-lg font-semibold">3. Documentos y certificaciones voluntarias</h2>
        <p className="text-texto-suave text-sm">
          Adjuntá el boleto de marca y señal y, opcionalmente, declará certificaciones comerciales
          voluntarias (Eje 2). Los hashes SHA-256 se calculan al enviar el formulario.
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

        <div className="rounded-tarjeta border-borde bg-panel space-y-4 border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-texto text-sm font-semibold">
                Certificaciones comerciales voluntarias (Eje 2 · Valor agregado)
              </h3>
              <p className="text-texto-suave mt-0.5 text-xs">
                Opcionales. Aportan valor comercial en góndola (UE / Mercosur) y actúan como filtro
                de compra, sin sustituir los 3 sellos obligatorios de acceso aduanero EUDR + SENASA
                (Eje 1).
              </p>
            </div>
            <span className="border-borde-fuerte bg-panel-elevado text-texto-suave rounded border px-2 py-0.5 font-mono text-[11px]">
              Eje 2 · Voluntario
            </span>
          </div>

          <div className="space-y-3">
            {CERTIFICACIONES_COMERCIALES.map((cert) => {
              const activa = certsActivas[cert.codigo];
              const usaDemo = certsUsarDemo[cert.codigo];

              return (
                <div
                  key={cert.codigo}
                  className={`rounded-tarjeta border p-3.5 transition-colors ${
                    activa
                      ? 'border-brand-fuerte/50 bg-brand/5'
                      : 'border-borde bg-panel-elevado/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      id={`cert_activa_${cert.codigo}`}
                      name={`cert_activa_${cert.codigo}`}
                      type="checkbox"
                      checked={activa}
                      onChange={(e) =>
                        setCertsActivas((prev) => ({
                          ...prev,
                          [cert.codigo]: e.target.checked,
                        }))
                      }
                      className="accent-brand mt-1 h-4 w-4 shrink-0"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={`cert_activa_${cert.codigo}`}
                        className="text-texto cursor-pointer text-sm font-semibold"
                      >
                        {cert.nombre}
                      </label>
                      <p className="text-texto-suave text-xs">{cert.norma}</p>
                      <p className="text-texto-tenue mt-1 text-xs">{cert.rolTecnico}</p>
                    </div>
                  </div>

                  <div
                    className={activa ? 'border-borde mt-3 space-y-3 border-t pt-3 pl-7' : 'hidden'}
                  >
                    <input
                      type="hidden"
                      name={`cert_usar_demo_${cert.codigo}`}
                      value={usaDemo ? 'true' : 'false'}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={claseLabel} htmlFor={`cert_emisor_${cert.codigo}`}>
                          Entidad medidora / certificadora
                        </label>
                        <input
                          id={`cert_emisor_${cert.codigo}`}
                          name={`cert_emisor_${cert.codigo}`}
                          className={claseInput}
                          defaultValue={cert.emisorDefault}
                        />
                      </div>
                      <div>
                        <label className={claseLabel} htmlFor={`cert_observaciones_${cert.codigo}`}>
                          Alcance / plan de mitigación o manejo
                        </label>
                        <input
                          id={`cert_observaciones_${cert.codigo}`}
                          name={`cert_observaciones_${cert.codigo}`}
                          className={claseInput}
                          defaultValue={cert.observacionesDefault}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={claseLabel} htmlFor={`cert_pdf_${cert.codigo}`}>
                        Informe o certificado PDF (opcional, se calcula hash SHA-256)
                      </label>
                      <input
                        id={`cert_pdf_${cert.codigo}`}
                        name={`cert_pdf_${cert.codigo}`}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className={claseInput}
                        onChange={() =>
                          setCertsUsarDemo((prev) => ({ ...prev, [cert.codigo]: false }))
                        }
                      />
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="focus-visible:ring-foco text-brand-fuerte text-xs hover:underline focus-visible:ring-2 focus-visible:outline-none"
                          onClick={() =>
                            setCertsUsarDemo((prev) => ({ ...prev, [cert.codigo]: true }))
                          }
                        >
                          Usar PDF demo ({cert.demoPdfNombre})
                        </button>
                        {usaDemo && (
                          <span className="text-texto-suave text-xs">
                            ✓ Se adjuntará {cert.demoPdfNombre} con su hash SHA-256
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
              <p className="mt-1 text-xs text-red-700">{erroresEtapa.montoTotalFinanciacion}</p>
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
              <p className="mt-1 text-xs text-red-700">{erroresEtapa.pesoObjetivoKg}</p>
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
              <p className="mt-1 text-xs text-red-700">{erroresEtapa.plazoMeses}</p>
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
              <p className="mt-1 text-xs text-red-700">{erroresEtapa.fechaVigencia}</p>
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
            <p className="mt-1 text-xs text-red-700">{erroresEtapa.descripcionOperacion}</p>
          )}
        </div>

        <Aviso variante="info" titulo="Resumen antes de enviar">
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Cabezas: {csvInfo ? `${csvInfo.rows} · promedio ${csvInfo.promedio} kg` : 'sin CSV'}
            </li>
            <li>Polígono: {geo?.ok ? `${geo.superficieHa} ha válidas` : 'sin validar'}</li>
            <li>
              Humedales:{' '}
              {humedal.fase === 'resultado' && humedal.geometria === poligonoTexto
                ? descripcionHumedal(humedal.reporte)
                : humedal.fase === 'error'
                  ? 'el análisis falló; se reintenta antes de enviar'
                  : 'se analiza antes de enviar'}
            </li>
            <li>
              Al enviar se consulta Global Forest Watch (corte 31/12/2020) y se registra el Sello 1.
            </li>
          </ul>
        </Aviso>

        {humedal.fase === 'analizando' && humedal.geometria === poligonoTexto && (
          <p role="status" className="text-xs text-neutral-300">
            Analizando humedales del polígono…
          </p>
        )}
        {humedal.fase === 'error' && (
          <Aviso variante="error" titulo="No pudimos analizar el humedal">
            <ul className="list-disc space-y-1 pl-4">
              {humedal.errores.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            <p className="mt-1">
              Sin un análisis revisado no se puede enviar el lote: corregí el polígono o reintentá
              con el botón de abajo.
            </p>
          </Aviso>
        )}
        {analisisVigente && (
          <Aviso variante="exito" titulo="Análisis ambiental listo">
            Se revisó el polígono actual. Confirmá el envío con “Enviar lote y validar EUDR”.
          </Aviso>
        )}
      </section>

      <div className="border-borde flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Boton type="button" variante="secundario" onClick={retroceder} disabled={etapa === 0}>
          ← Atrás
        </Boton>

        {etapa < 3 ? (
          <Boton type="button" onClick={avanzar}>
            Siguiente →
          </Boton>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {!walletState?.address && (
              <span className="text-texto-suave text-xs">
                Conectá tu wallet Freighter en la etapa 1 para registrar el lote.
              </span>
            )}
            <Boton
              type="submit"
              cargando={pending || analizando}
              disabled={pending || analizando || !walletState?.address || !walletState.esTestnet}
              onClick={(event) => void alEnviar(event)}
            >
              {analizando
                ? 'Analizando humedales…'
                : pending
                  ? 'Validando EUDR y registrando Sello 1…'
                  : analisisVigente
                    ? 'Enviar lote y validar EUDR'
                    : 'Analizar humedal y revisar'}
            </Boton>
          </div>
        )}
      </div>
    </form>
  );
}
