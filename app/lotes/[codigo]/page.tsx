import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BannerRolRequerido } from '@/components/auth-guard';
import {
  CertificacionesComerciales,
  type CertificacionConUrlResuelta,
} from '@/components/certificaciones-comerciales';
import { ContactoProductor } from '@/components/contacto-productor';
import { DocumentosHashes } from '@/components/documentos-hashes';
import { EstadoBadge } from '@/components/estado-badge';
import { EvidenciaSatelital, type GfwConsulta } from '@/components/evidencia-satelital';
import { Aviso } from '@/components/ui/aviso';
import { Boton } from '@/components/ui/boton';
import { Tabla } from '@/components/ui/tabla';
import { Tarjeta } from '@/components/ui/tarjeta';
import { reintentarGfwAction } from '@/lib/actions';
import { getCurrentUser } from '@/lib/auth';
import { construirDocumentos } from '@/lib/documentos-hashes';
import { normalizarCertificacionesComerciales, type EstadoLote } from '@/lib/domain';
import { calcularDesembolsos } from '@/lib/escrow';
import { getLoteCompleto } from '@/lib/queries';
import { esWalletStellar } from '@/lib/stellar-args';
import { createAdminClient } from '@/lib/storage';
import { FormFondeo } from './form-fondeo';

export const dynamic = 'force-dynamic';

async function urlFirmada(bucket: string, path: unknown, expires = 3600): Promise<string | null> {
  if (typeof path !== 'string' || path.length === 0) return null;
  if (path.startsWith('/') || path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  try {
    const admin = createAdminClient();
    const { data } = await admin.storage.from(bucket).createSignedUrl(path, expires);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

function TxLink({ etiqueta, txHash }: { etiqueta: string; txHash: unknown }) {
  if (typeof txHash !== 'string' || txHash.length === 0) return null;
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
      target="_blank"
      rel="noreferrer"
      className="focus-visible:ring-foco text-brand-fuerte inline-flex items-center gap-1 text-xs hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      {etiqueta}
      <ExternalLink aria-hidden="true" className="h-3 w-3" />
    </a>
  );
}

function SelloItem({
  numero,
  nombre,
  activo,
  falta,
  esUltimo = false,
}: {
  numero: number;
  nombre: string;
  activo: boolean;
  falta: string;
  esUltimo?: boolean;
}) {
  return (
    <li className="relative flex items-start gap-3.5 pb-4 last:pb-0">
      {!esUltimo && (
        <span
          aria-hidden="true"
          className={`absolute top-6 -bottom-1 left-3 w-0.5 -translate-x-1/2 ${
            activo ? 'bg-brand-fuerte/50' : 'bg-borde-fuerte'
          }`}
        />
      )}
      <span
        aria-hidden="true"
        className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${
          activo
            ? 'border-brand-fuerte bg-brand text-neutral-950 shadow-2xs'
            : 'border-borde-fuerte bg-panel text-texto-tenue'
        }`}
      >
        {numero}
      </span>
      <div>
        <p className={`text-sm font-semibold ${activo ? 'text-texto' : 'text-texto-suave'}`}>
          {nombre}
        </p>
        <p className="text-texto-tenue text-xs">
          {activo ? 'Verificado y anclado en Stellar.' : `Falta: ${falta}`}
        </p>
      </div>
    </li>
  );
}

export default async function LotePage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ gfw?: string; msg?: string; error?: string }>;
}) {
  const { codigo } = await params;
  const sp = await searchParams;
  const currentUser = await getCurrentUser();
  const data = await getLoteCompleto(codigo);

  if (!data) notFound();

  const { lote, caravanas, movimientos, auditorias, recepciones, productor } = data;
  const estado = lote.estado_publicacion as EstadoLote;
  const gfw = (lote.gfw_consulta ?? null) as GfwConsulta | null;
  const renspaUrl = await urlFirmada('documentos', lote.renspa_doc_url);
  const boletoUrl = await urlFirmada('documentos', lote.boleto_marca_url);

  const movimientosTipados = movimientos as {
    id: string;
    tipo: string;
    monto: number;
    moneda: string;
    tx_hash: string | null;
  }[];
  const liberado = movimientosTipados
    .filter((m) => m.tipo.startsWith('RELEASE_'))
    .reduce((a, m) => a + Number(m.monto), 0);
  const liberados = new Set(movimientosTipados.map((m) => m.tipo));

  const montos = calcularDesembolsos(Number(lote.monto_total_financiacion ?? 0));
  const moneda = String(lote.moneda ?? 'USDC');
  const pagos = [
    {
      hito: 'Al inicio',
      porcentaje: '40 %',
      monto: montos.hito1,
      liberado: liberados.has('RELEASE_MILESTONE_1'),
    },
    {
      hito: 'Mes 4',
      porcentaje: '30 %',
      monto: montos.hito2,
      liberado: liberados.has('RELEASE_MILESTONE_2'),
    },
    {
      hito: 'En la entrega',
      porcentaje: '30 %',
      monto: montos.hito3,
      liberado: liberados.has('RELEASE_MILESTONE_3'),
    },
  ];

  const documentos = construirDocumentos({
    renspaDocHash: lote.renspa_doc_hash,
    rfidListHash: lote.rfid_list_hash,
    eudrGeoHash: lote.eudr_geo_hash,
    actaHash: auditorias[0]?.acta_hash,
    dteHash: recepciones[0]?.dte_hash,
  });

  const sello2 = Boolean(lote.seal_2_sanitary);
  const certificacionesNormalizadas = normalizarCertificacionesComerciales(
    lote.certificaciones_comerciales,
  );
  const certificacionesConUrl: CertificacionConUrlResuelta[] = await Promise.all(
    certificacionesNormalizadas.map(async (cert) => ({
      ...cert,
      docUrlResuelta: await urlFirmada('documentos', cert.doc_url),
    })),
  );
  const tituloLimpio = String(lote.titulo ?? 'Lote sin título')
    .replace(/^\[DEMO\]\s*/i, '')
    .replace(/\s*[-–·]\s*\d+\s*kg\s*$/i, '');

  const montoTotal = Number(lote.monto_total_financiacion ?? 0);
  const pctHumedal =
    lote.porcentaje_humedal != null && !Number.isNaN(Number(lote.porcentaje_humedal))
      ? `${Number(lote.porcentaje_humedal).toLocaleString('es-AR', { maximumFractionDigits: 1 })} % humedal`
      : null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <Link
        href="/mercado"
        className="focus-visible:ring-foco hover:text-brand-fuerte text-texto-suave inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Volver al mercado
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-texto-tenue font-mono text-xs font-medium tracking-wider">
                {lote.codigo_lote}
              </span>
              <EstadoBadge estado={estado} />
              {lote.tipo_operacion && (
                <span className="border-borde bg-panel text-texto-suave rounded-full border px-2.5 py-0.5 text-xs">
                  {lote.tipo_operacion}
                </span>
              )}
            </div>
            <h1 className="text-texto mt-1.5 text-2xl font-bold tracking-tight md:text-3xl">
              {tituloLimpio}
            </h1>
            <p className="text-texto-suave mt-1 text-sm">
              {lote.localidad}, {lote.provincia} · RENSPA{' '}
              <span className="font-mono text-xs">{lote.renspa}</span>
            </p>
          </div>
          {estado === 'CERRADO_CICLO' && (
            <Link
              href={`/pasaporte/${lote.codigo_lote}`}
              className="rounded-control focus-visible:ring-foco bg-brand hover:bg-brand/90 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
            >
              Ver pasaporte EUDR
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* Tira de métricas principales */}
        <div className="rounded-tarjeta border-borde divide-borde bg-panel grid grid-cols-2 divide-x divide-y border sm:grid-cols-4 sm:divide-y-0">
          <div className="px-4 py-3">
            <p className="text-texto-tenue text-[11px] font-medium tracking-wider uppercase">
              Financiación
            </p>
            <p className="text-texto mt-0.5 text-lg font-bold tabular-nums">
              {moneda} {montoTotal.toLocaleString('es-AR')}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-texto-tenue text-[11px] font-medium tracking-wider uppercase">
              Cabezas
            </p>
            <p className="text-texto mt-0.5 text-lg font-bold tabular-nums">
              {lote.cantidad_cabezas}{' '}
              <span className="text-texto-suave text-xs font-normal">
                · {lote.raza ?? lote.categoria}
              </span>
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-texto-tenue text-[11px] font-medium tracking-wider uppercase">
              Peso promedio
            </p>
            <p className="text-texto mt-0.5 text-lg font-bold tabular-nums">
              {lote.peso_promedio_kg} kg
              {lote.peso_objetivo_kg ? (
                <span className="text-texto-suave text-xs font-normal">
                  {' '}
                  → {lote.peso_objetivo_kg} kg
                </span>
              ) : null}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-texto-tenue text-[11px] font-medium tracking-wider uppercase">
              Superficie
            </p>
            <p className="text-texto mt-0.5 text-lg font-bold tabular-nums">
              {lote.superficie_ha} ha
              {pctHumedal ? (
                <span className="text-texto-suave text-xs font-normal"> · {pctHumedal}</span>
              ) : null}
            </p>
          </div>
        </div>
      </header>

      {sp.gfw === 'error' && (
        <Aviso variante="error" titulo="No se pudo validar contra Global Forest Watch">
          {sp.msg ?? 'Reintentá la validación desde esta pantalla.'}
        </Aviso>
      )}
      {sp.error && (
        <Aviso variante="error" titulo="Ocurrió un problema">
          {sp.error}
        </Aviso>
      )}

      {/* Acción principal según el estado del lote (sin duplicar tarjeta de resumen) */}
      {estado === 'DISPONIBLE' && (
        <Tarjeta
          titulo="Fondear el pago en garantía"
          descripcion={`Depositás ${moneda} ${montoTotal.toLocaleString('es-AR')} en garantía y se libera el 40 % inicial (${moneda} ${montos.hito1.toLocaleString('es-AR')}) al productor.`}
          acciones={
            currentUser?.rol === 'COMPRADOR' ? (
              <span className="border-borde bg-panel-elevado text-texto-suave inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
                <span className="text-texto font-medium">{currentUser.nombre_completo}</span>
                {currentUser.cuit && (
                  <span className="text-texto-tenue font-mono text-[11px]">
                    · CUIT {currentUser.cuit}
                  </span>
                )}
              </span>
            ) : undefined
          }
        >
          {currentUser?.rol !== 'COMPRADOR' ? (
            <BannerRolRequerido
              rolRequerido="COMPRADOR"
              titulo="El fondeo requiere cuenta de Comprador"
              descripcion="Para comprometer los fondos en garantía y financiar este lote tenés que identificarte como Comprador."
              userActual={currentUser}
              redirectTo={`/lotes/${codigo}`}
            />
          ) : (
            <FormFondeo
              codigoLote={String(lote.codigo_lote)}
              monto={montoTotal}
              productorWallet={lote.productor_wallet ?? undefined}
              buyerNombreInicial={currentUser.nombre_completo}
              buyerWalletInicial={currentUser.wallet ?? undefined}
            />
          )}
        </Tarjeta>
      )}

      {estado === 'FINANCIADO_EN_ENGORDE' && !sello2 && (
        <Tarjeta
          titulo="Auditoría del Mes 4 pendiente"
          descripcion="La ejecuta el Veterinario acreditado: acta SIGSA, pesada RFID y validación del ADPV para liberar el 30 %."
        >
          <Link
            href={`/lotes/${lote.codigo_lote}/auditoria`}
            className="rounded-control focus-visible:ring-foco bg-brand inline-flex items-center px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Ir a auditoría veterinaria
            <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
          </Link>
        </Tarjeta>
      )}

      {estado === 'FINANCIADO_EN_ENGORDE' && sello2 && (
        <Tarjeta
          titulo="Listo para despacho y recepción"
          descripcion="El Productor despacha con DT-e y el frigorífico confirma la recepción en balanza fiscal; se libera el 30 % final con ajuste por kilos."
        >
          <Link
            href={`/lotes/${lote.codigo_lote}/recepcion`}
            className="rounded-control focus-visible:ring-foco bg-brand inline-flex items-center px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Ir a despacho y recepción
            <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
          </Link>
        </Tarjeta>
      )}

      {estado === 'EN_TRANSITO_A_FRIGORIFICO' && (
        <Tarjeta
          titulo="Camión en tránsito"
          descripcion="El frigorífico debe registrar el pesaje de recepción en balanza fiscal para cerrar el ciclo."
        >
          <Link
            href={`/lotes/${lote.codigo_lote}/recepcion`}
            className="rounded-control focus-visible:ring-foco bg-brand inline-flex items-center px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Registrar recepción
            <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
          </Link>
        </Tarjeta>
      )}

      {estado === 'RECHAZADO_EUDR' && (
        <Aviso variante="error" titulo="Lote no conforme EUDR">
          Se detectó pérdida de bosque posterior al 31/12/2020, por lo que el lote no es apto para
          exportación EUDR.
        </Aviso>
      )}

      {estado === 'PENDIENTE_VALIDACION' && (
        <Aviso variante="alerta" titulo="Validación EUDR pendiente">
          <p>Quedó pendiente por un error de red o falta de reintento.</p>
          <form action={reintentarGfwAction} className="mt-3">
            <input type="hidden" name="codigo" value={String(lote.codigo_lote)} />
            <Boton type="submit">Reintentar validación EUDR</Boton>
          </form>
        </Aviso>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta
          titulo="Sellos EUDR"
          descripcion="Cumplimiento aduanero y sanitario anclado en Stellar."
        >
          <ol className="mt-1">
            <SelloItem
              numero={1}
              nombre="Origen libre de deforestación"
              activo={Boolean(lote.seal_1_eudr)}
              falta="validación satelital EUDR y polígono"
            />
            <SelloItem
              numero={2}
              nombre="Sanidad y engorde"
              activo={sello2}
              falta="auditoría del Mes 4 del Veterinario acreditado"
            />
            <SelloItem
              numero={3}
              nombre="Cierre y recepción"
              activo={Boolean(lote.seal_3_reception)}
              falta="despacho DT-e y recepción en balanza fiscal"
              esUltimo
            />
          </ol>
        </Tarjeta>

        <Tarjeta
          titulo="Cronograma de pagos"
          descripcion="Liberación por hitos verificados en garantía."
          acciones={
            <span className="text-texto-suave font-mono text-xs">
              Liberado:{' '}
              <strong className="text-texto">
                {moneda} {liberado.toLocaleString('es-AR')}
              </strong>
            </span>
          }
        >
          <div className="grid gap-2.5 sm:grid-cols-3">
            {pagos.map((pago, idx) => (
              <div
                key={pago.hito}
                className={`rounded-tarjeta flex flex-col justify-between border p-3.5 ${
                  pago.liberado
                    ? 'border-brand-fuerte/40 bg-brand/5'
                    : 'border-borde bg-panel-elevado/35'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-texto-tenue font-mono text-[11px] font-semibold">
                      Hito {idx + 1}
                    </span>
                    <span className="border-borde bg-panel text-texto-suave rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap">
                      {pago.porcentaje.replace(/\s+/g, '')}
                    </span>
                  </div>
                  <p className="text-texto mt-2.5 text-base font-bold tabular-nums">
                    {moneda} {pago.monto.toLocaleString('es-AR')}
                  </p>
                  <p className="text-texto-suave mt-0.5 text-xs">{pago.hito}</p>
                </div>

                <div className="mt-3 pt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                      pago.liberado
                        ? 'bg-brand font-semibold text-neutral-950'
                        : 'border-borde bg-panel text-texto-tenue border'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        pago.liberado ? 'bg-neutral-950' : 'bg-texto-tenue/70'
                      }`}
                    />
                    {pago.liberado ? 'Liberado' : 'Pendiente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>

      <CertificacionesComerciales
        codigoLote={String(lote.codigo_lote)}
        certificaciones={certificacionesConUrl}
        permitirEdicion={true}
        userActual={currentUser}
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <EvidenciaSatelital gfw={gfw} poligono={lote.poligono_geojson} />

          <Tarjeta titulo="Detalles técnicos verificables">
            <details>
              <summary className="text-texto cursor-pointer text-sm font-semibold">
                Transacciones, caravanas y accesos técnicos
              </summary>
              <div className="mt-4 space-y-5">
                <div className="flex flex-wrap gap-4 text-xs">
                  <TxLink etiqueta="Tx Sello 1" txHash={lote.soroban_create_tx_hash} />
                  <TxLink etiqueta="Tx fondeo" txHash={lote.soroban_fund_tx_hash} />
                  <TxLink etiqueta="Tx Sello 2" txHash={lote.soroban_seal2_tx_hash} />
                  <TxLink etiqueta="Tx Sello 3" txHash={lote.soroban_seal3_tx_hash} />
                </div>

                <div className="flex flex-wrap gap-4 text-xs">
                  {renspaUrl && (
                    <a
                      className="focus-visible:ring-foco text-brand-fuerte inline-flex items-center gap-1 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      href={renspaUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver constancia RENSPA
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    </a>
                  )}
                  {boletoUrl && (
                    <a
                      className="focus-visible:ring-foco text-brand-fuerte inline-flex items-center gap-1 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      href={boletoUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver boleto de marca
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    </a>
                  )}
                  {!renspaUrl && !boletoUrl && (
                    <span className="text-texto-tenue">Documentos con acceso restringido.</span>
                  )}
                </div>

                <div>
                  <h3 className="text-texto text-sm font-semibold">
                    Caravanas RFID ({caravanas.length})
                  </h3>
                  <Tabla
                    className="mt-2"
                    columnas={[
                      { clave: 'rfid', titulo: 'RFID' },
                      { clave: 'inicial', titulo: 'Peso inicial', numerica: true },
                      { clave: 'mes4', titulo: 'Peso mes 4', numerica: true },
                      { clave: 'final', titulo: 'Peso final', numerica: true },
                    ]}
                    vacio="Todavía no hay caravanas cargadas."
                    filas={(
                      caravanas as {
                        id: string;
                        rfid: string;
                        peso_inicial_kg: number | null;
                        peso_mes4_kg: number | null;
                        peso_final_kg: number | null;
                      }[]
                    ).map((caravana) => ({
                      rfid: <span className="font-mono">{caravana.rfid}</span>,
                      inicial:
                        caravana.peso_inicial_kg != null ? `${caravana.peso_inicial_kg} kg` : '—',
                      mes4: caravana.peso_mes4_kg != null ? `${caravana.peso_mes4_kg} kg` : '—',
                      final: caravana.peso_final_kg != null ? `${caravana.peso_final_kg} kg` : '—',
                    }))}
                  />
                </div>

                <div>
                  <h3 className="text-texto text-sm font-semibold">Movimientos del escrow</h3>
                  <Tabla
                    className="mt-2"
                    columnas={[
                      { clave: 'tipo', titulo: 'Movimiento' },
                      { clave: 'monto', titulo: 'Monto', numerica: true },
                      { clave: 'tx', titulo: 'Tx' },
                    ]}
                    vacio="Sin movimientos todavía (se fondea en el Paso 2)."
                    filas={movimientosTipados.map((movimiento) => ({
                      tipo: movimiento.tipo,
                      monto: `${movimiento.moneda} ${Number(movimiento.monto).toLocaleString('es-AR')}`,
                      tx: movimiento.tx_hash ? (
                        <TxLink etiqueta="ver" txHash={movimiento.tx_hash} />
                      ) : (
                        '—'
                      ),
                    }))}
                  />
                </div>

                <div className="text-texto-suave space-y-1 text-sm">
                  <h3 className="text-texto text-sm font-semibold">Productor y trazabilidad</h3>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p>
                      Productor:{' '}
                      {productor?.nombre_razon_social ??
                        (lote.productor_wallet && esWalletStellar(String(lote.productor_wallet))
                          ? String(lote.productor_wallet)
                          : 'Productor registrado')}
                      {productor?.cuit ? ` · CUIT ${productor.cuit}` : ''}
                    </p>
                    <ContactoProductor />
                  </div>
                  <p className="text-texto-tenue font-mono text-xs">
                    {lote.productor_wallet && esWalletStellar(String(lote.productor_wallet))
                      ? String(lote.productor_wallet)
                      : 'Wallet pendiente de vinculación en Freighter'}
                  </p>
                  <p className="text-texto-tenue text-xs">
                    {lote.cantidad_cabezas} cabezas · {lote.peso_promedio_kg} kg promedio (
                    {lote.peso_min_kg}–{lote.peso_max_kg}) · {lote.uniformidad}
                  </p>
                  <p className="text-texto-tenue text-xs">
                    Auditorías veterinarias: {auditorias.length} · Recepciones: {recepciones.length}{' '}
                    (Pasos 3 y 4)
                  </p>
                </div>
              </div>
            </details>
          </Tarjeta>
        </div>

        <DocumentosHashes
          documentos={documentos}
          videoUrl={lote.video_url ?? null}
          renspaUrl={renspaUrl}
          boletoUrl={boletoUrl}
        />
      </div>
    </main>
  );
}
