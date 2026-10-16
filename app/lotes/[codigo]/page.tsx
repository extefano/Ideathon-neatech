import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BannerRolRequerido, CredencialSesion } from '@/components/auth-guard';
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
import type { EstadoLote } from '@/lib/domain';
import { calcularDesembolsos } from '@/lib/escrow';
import { resumirLote } from '@/lib/estado-lote';
import { getLoteCompleto } from '@/lib/queries';
import { createAdminClient } from '@/lib/storage';
import { FormFondeo } from './form-fondeo';

export const dynamic = 'force-dynamic';

async function urlFirmada(bucket: string, path: unknown, expires = 3600): Promise<string | null> {
  if (typeof path !== 'string' || path.length === 0) return null;
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
      className="focus-visible:ring-foco text-brand text-xs hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      {etiqueta} ↗
    </a>
  );
}

function SelloItem({ nombre, activo, falta }: { nombre: string; activo: boolean; falta: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
          activo ? 'border-brand text-brand' : 'border-neutral-600 text-neutral-500'
        }`}
      >
        {activo ? '✓' : '·'}
      </span>
      <div>
        <p className={`text-sm font-semibold ${activo ? 'text-neutral-100' : 'text-neutral-400'}`}>
          {nombre}
        </p>
        <p className="text-xs text-neutral-500">
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
  const resumen = resumirLote({
    estado,
    seal_2_sanitary: Boolean(lote.seal_2_sanitary),
    codigo: String(lote.codigo_lote),
  });

  const pagos = [
    {
      hito: 'Al inicio (40 %)',
      monto: montos.hito1,
      liberado: liberados.has('RELEASE_MILESTONE_1'),
    },
    { hito: 'Mes 4 (30 %)', monto: montos.hito2, liberado: liberados.has('RELEASE_MILESTONE_2') },
    {
      hito: 'En la entrega (30 %)',
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

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <Link href="/" className="focus-visible:ring-foco hover:text-brand text-sm text-neutral-400">
        ← Lotes
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-neutral-400">{lote.codigo_lote}</span>
            <EstadoBadge estado={estado} />
          </div>
          <h1 className="mt-2 text-3xl font-bold">{lote.titulo ?? 'Lote sin título'}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            RENSPA {lote.renspa} · {lote.localidad}, {lote.provincia} · {lote.superficie_ha} ha ·{' '}
            {lote.tipo_operacion ?? '—'}
          </p>
        </div>
        {estado === 'CERRADO_CICLO' && (
          <Link
            href={`/pasaporte/${lote.codigo_lote}`}
            className="rounded-control focus-visible:ring-foco bg-brand hover:bg-brand/90 min-h-11 px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Ver pasaporte EUDR
          </Link>
        )}
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

      <Tarjeta titulo="Resumen y próximos pasos" descripcion={resumen.descripcion}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-neutral-300">
            Estado canónico: <span className="text-neutral-100">{resumen.canonico}</span>
          </span>
          {resumen.accion && estado !== 'DISPONIBLE' && (
            <Link
              href={resumen.accion.href}
              className="rounded-control focus-visible:ring-foco bg-brand min-h-11 px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
            >
              {resumen.accion.texto} →
            </Link>
          )}
        </div>
      </Tarjeta>

      {/* Acciones de rol por estado */}
      {estado === 'DISPONIBLE' && (
        <Tarjeta
          titulo="Fondear el pago en garantía"
          descripcion={`Depósito de ${moneda} ${Number(lote.monto_total_financiacion ?? 0).toLocaleString('es-AR')}. El Productor cobra ${moneda} ${montos.hito1.toLocaleString('es-AR')} ahora (40 %), ${moneda} ${montos.hito2.toLocaleString('es-AR')} a mitad del engorde (30 %) y ${moneda} ${montos.hito3.toLocaleString('es-AR')} en la entrega (30 %).`}
        >
          {currentUser?.rol !== 'COMPRADOR' ? (
            <BannerRolRequerido
              rolRequerido="COMPRADOR"
              titulo="El fondeo requiere cuenta de Comprador"
              descripcion="Para comprometer los fondos en garantía y financiar la tropa tenés que identificarte como Comprador."
              userActual={currentUser}
              redirectTo={`/lotes/${codigo}`}
            />
          ) : (
            <div className="space-y-3">
              <CredencialSesion user={currentUser} />
              <FormFondeo
                codigoLote={String(lote.codigo_lote)}
                monto={Number(lote.monto_total_financiacion ?? 0)}
                productorWallet={lote.productor_wallet ?? undefined}
                buyerNombreInicial={currentUser.nombre_completo}
                buyerWalletInicial={currentUser.wallet ?? undefined}
              />
            </div>
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
            className="rounded-control focus-visible:ring-foco bg-brand inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Ir a auditoría veterinaria →
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
            className="rounded-control focus-visible:ring-foco bg-brand inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Ir a despacho y recepción →
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
            className="rounded-control focus-visible:ring-foco bg-brand inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Registrar recepción →
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
        <Tarjeta titulo="Progreso de los 3 sellos">
          <ul className="space-y-4">
            <SelloItem
              nombre="Sello 1 · Origen libre de deforestación"
              activo={Boolean(lote.seal_1_eudr)}
              falta="validación satelital EUDR y polígono"
            />
            <SelloItem
              nombre="Sello 2 · Sanidad y engorde"
              activo={sello2}
              falta="auditoría del Mes 4 del Veterinario acreditado"
            />
            <SelloItem
              nombre="Sello 3 · Cierre y recepción"
              activo={Boolean(lote.seal_3_reception)}
              falta="despacho DT-e y recepción en balanza fiscal"
            />
          </ul>
        </Tarjeta>

        <Tarjeta
          titulo="Cronograma de pagos"
          descripcion={`El Comprador deposita en garantía. Liberado hasta ahora: ${moneda} ${liberado.toLocaleString('es-AR')}.`}
        >
          <Tabla
            columnas={[
              { clave: 'hito', titulo: 'Hito' },
              { clave: 'monto', titulo: `Monto (${moneda})`, numerica: true },
              { clave: 'estado', titulo: 'Estado' },
            ]}
            filas={pagos.map((pago) => ({
              hito: pago.hito,
              monto: pago.monto.toLocaleString('es-AR'),
              estado: pago.liberado ? 'Liberado' : 'Pendiente',
            }))}
          />
        </Tarjeta>
      </div>

      <EvidenciaSatelital gfw={gfw} poligono={lote.poligono_geojson} />

      <DocumentosHashes documentos={documentos} videoUrl={lote.video_url ?? null} />

      <Tarjeta titulo="Detalles técnicos verificables">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-neutral-200">
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
                  className="focus-visible:ring-foco text-brand hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  href={renspaUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver constancia RENSPA ↗
                </a>
              )}
              {boletoUrl && (
                <a
                  className="focus-visible:ring-foco text-brand hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  href={boletoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver boleto de marca ↗
                </a>
              )}
              {!renspaUrl && !boletoUrl && (
                <span className="text-neutral-500">Documentos con acceso restringido.</span>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-200">
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
              <h3 className="text-sm font-semibold text-neutral-200">Movimientos del escrow</h3>
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

            <div className="space-y-1 text-sm text-neutral-300">
              <h3 className="text-sm font-semibold text-neutral-200">Productor y trazabilidad</h3>
              <p>
                Productor: {productor?.nombre_razon_social ?? lote.productor_wallet ?? '—'}
                {productor?.cuit ? ` · CUIT ${productor.cuit}` : ''}
              </p>
              <p className="font-mono text-xs text-neutral-500">{lote.productor_wallet}</p>
              <p className="text-xs text-neutral-500">
                {lote.cantidad_cabezas} cabezas · {lote.peso_promedio_kg} kg promedio (
                {lote.peso_min_kg}–{lote.peso_max_kg}) · {lote.uniformidad}
              </p>
            </div>
          </div>
        </details>
      </Tarjeta>
    </main>
  );
}
