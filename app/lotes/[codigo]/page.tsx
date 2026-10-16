import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BannerRolRequerido, CredencialSesion } from '@/components/auth-guard';
import { EstadoBadge } from '@/components/estado-badge';
import { MapaLote } from '@/components/mapa-lote';
import { reintentarGfwAction } from '@/lib/actions';
import { getCurrentUser } from '@/lib/auth';
import { FormFondeo } from './form-fondeo';
import type { EstadoLote } from '@/lib/domain';
import { calcularDesembolsos } from '@/lib/escrow';
import { getLoteCompleto } from '@/lib/queries';
import { esWalletStellar } from '@/lib/stellar-args';
import { createAdminClient } from '@/lib/storage';

export const dynamic = 'force-dynamic';

type GfwConsulta = {
  totalLossHa?: number;
  checkedAt?: string;
  criterio?: string;
  byYear?: { year: number; lossHa: number }[];
};

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

function Chip({ activo, texto }: { activo: boolean; texto: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
        activo
          ? 'border-brand/40 bg-brand/10 text-brand'
          : 'border-neutral-700 bg-neutral-900 text-neutral-500'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${activo ? 'bg-brand' : 'bg-neutral-600'}`} />
      {texto}
    </span>
  );
}

function HashLinea({ etiqueta, valor }: { etiqueta: string; valor: unknown }) {
  const texto = typeof valor === 'string' && valor.length > 0 ? valor : null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-neutral-900 py-1.5 text-xs">
      <span className="text-neutral-500">{etiqueta}</span>
      {texto ? (
        <span className="truncate font-mono text-neutral-300" title={texto}>
          {texto.slice(0, 20)}…{texto.slice(-8)}
        </span>
      ) : (
        <span className="text-neutral-600">—</span>
      )}
    </div>
  );
}

function TxLink({ etiqueta, txHash }: { etiqueta: string; txHash: unknown }) {
  if (typeof txHash !== 'string' || txHash.length === 0) return null;
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
      target="_blank"
      rel="noreferrer"
      className="text-brand hover:text-brand/80 text-xs"
    >
      {etiqueta} ↗
    </a>
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

  const liberado = (movimientos as { tipo: string; monto: number }[])
    .filter((m) => m.tipo.startsWith('RELEASE_'))
    .reduce((a, m) => a + Number(m.monto), 0);

  const desembolsos = calcularDesembolsos(Number(lote.monto_total_financiacion ?? 0));
  const moneda = String(lote.moneda ?? 'USDC');

  return (
    <main className="mx-auto max-w-6xl p-8">
      <Link href="/" className="hover:text-brand text-sm text-neutral-400">
        ← Lotes
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
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
            className="bg-brand hover:bg-brand/90 rounded-md px-4 py-2 text-sm font-semibold text-neutral-950"
          >
            Ver Pasaporte EUDR
          </Link>
        )}
      </header>

      {sp.gfw === 'error' && (
        <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {sp.msg ?? 'Error consultando Global Forest Watch'}
        </div>
      )}

      {sp.error && (
        <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {sp.error}
        </div>
      )}

      {estado === 'DISPONIBLE' && (
        <section className="border-brand/30 bg-brand/5 mt-6 rounded-lg border p-5">
          <h2 className="text-lg font-semibold">Fondear escrow — Paso 2</h2>
          <p className="mt-1 text-sm text-neutral-300">
            Depósito de {moneda}{' '}
            {Number(lote.monto_total_financiacion ?? 0).toLocaleString('es-AR')}:{' '}
            <span className="text-brand">
              {moneda} {desembolsos.hito1.toLocaleString('es-AR')} al productor (Hito 1 · 40%)
            </span>{' '}
            · {moneda} {desembolsos.hito2.toLocaleString('es-AR')} retenido (Mes 4 · 30%) · {moneda}{' '}
            {desembolsos.hito3.toLocaleString('es-AR')} retenido (recepción · 30%).
          </p>
          {currentUser?.rol !== 'COMPRADOR' ? (
            <div className="mt-4">
              <BannerRolRequerido
                rolRequerido="COMPRADOR"
                titulo="El fondeo de escrow requiere cuenta de Comprador"
                descripcion="Para comprometer fondos en el contrato escrow y financiar la tropa debés identificarte con un perfil de Comprador (Frigorífico o Inversor)."
                userActual={currentUser}
                redirectTo={`/lotes/${codigo}`}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
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
          <p className="mt-2 text-xs text-neutral-500">
            Auto-compra bloqueada (la wallet del comprador debe ser distinta a la del productor) y
            doble fondeo bloqueado (solo lotes DISPONIBLE).
          </p>
        </section>
      )}

      {estado === 'FINANCIADO_EN_ENGORDE' && !lote.seal_2_sanitary && (
        <section className="border-brand/30 bg-brand/5 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-5">
          <div>
            <h2 className="text-lg font-semibold">Auditoría del Mes 4 (Paso 3)</h2>
            <p className="mt-1 text-sm text-neutral-300">
              El veterinario acreditado carga el acta SIGSA y la balanza con RFID para validar el
              ADPV (0,5–1,3 kg/día) y liberar el 30% del escrow.
            </p>
          </div>
          <Link
            href={`/lotes/${lote.codigo_lote}/auditoria`}
            className="bg-brand hover:bg-brand/90 rounded-md px-4 py-2 text-sm font-semibold text-neutral-950"
          >
            Ir a auditoría veterinaria
          </Link>
        </section>
      )}

      {estado === 'FINANCIADO_EN_ENGORDE' && lote.seal_2_sanitary && (
        <section className="border-brand/30 bg-brand/5 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-5">
          <div>
            <h2 className="text-lg font-semibold">Cierre de ciclo (Paso 4)</h2>
            <p className="mt-1 text-sm text-neutral-300">
              El productor despacha con DT-e y el frigorífico confirma la recepción en balanza
              fiscal; se libera el 30% final con ajuste por kilos.
            </p>
          </div>
          <Link
            href={`/lotes/${lote.codigo_lote}/recepcion`}
            className="bg-brand hover:bg-brand/90 rounded-md px-4 py-2 text-sm font-semibold text-neutral-950"
          >
            Ir a despacho y recepción
          </Link>
        </section>
      )}

      {estado === 'EN_TRANSITO_A_FRIGORIFICO' && (
        <section className="border-brand/30 bg-brand/5 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-5">
          <div>
            <h2 className="text-lg font-semibold">Camión en tránsito</h2>
            <p className="mt-1 text-sm text-neutral-300">
              El frigorífico debe registrar el pesaje de recepción en balanza fiscal para cerrar el
              ciclo.
            </p>
          </div>
          <Link
            href={`/lotes/${lote.codigo_lote}/recepcion`}
            className="bg-brand hover:bg-brand/90 rounded-md px-4 py-2 text-sm font-semibold text-neutral-950"
          >
            Registrar recepción
          </Link>
        </section>
      )}

      {estado === 'RECHAZADO_EUDR' && (
        <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          <p className="font-semibold">
            Lote rechazado por EUDR — se detectó pérdida de bosque posterior al 31/12/2020.
          </p>
          {gfw?.byYear && (
            <ul className="mt-2 list-disc pl-5">
              {gfw.byYear.map((anio) => (
                <li key={anio.year}>
                  {anio.year}: {anio.lossHa} ha
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {estado === 'PENDIENTE_VALIDACION' && (
        <div className="border-brand/40 bg-brand/10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 text-sm text-neutral-200">
          <p>La validación EUDR quedó pendiente (error de red o sin reintento).</p>
          <form action={reintentarGfwAction}>
            <input type="hidden" name="codigo" value={String(lote.codigo_lote)} />
            <button
              type="submit"
              className="bg-brand hover:bg-brand/90 rounded-md px-4 py-2 text-sm font-semibold text-neutral-950"
            >
              Reintentar validación EUDR
            </button>
          </form>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Sellos en Soroban (modo demo testnet)</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Chip activo={Boolean(lote.seal_1_eudr)} texto="Sello 1 · Origen EUDR" />
          <Chip activo={Boolean(lote.seal_2_sanitary)} texto="Sello 2 · Sanidad y engorde" />
          <Chip activo={Boolean(lote.seal_3_reception)} texto="Sello 3 · Cierre y recepción" />
        </div>
        <div className="mt-2 flex gap-4">
          <TxLink etiqueta="Tx Sello 1" txHash={lote.soroban_create_tx_hash} />
          <TxLink etiqueta="Tx fondeo" txHash={lote.soroban_fund_tx_hash} />
          <TxLink etiqueta="Tx Sello 2" txHash={lote.soroban_seal2_tx_hash} />
          <TxLink etiqueta="Tx Sello 3" txHash={lote.soroban_seal3_tx_hash} />
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-5">
          <h2 className="text-lg font-semibold">Evidencia satelital (EUDR)</h2>
          <div className="mt-3">
            <MapaLote poligono={lote.poligono_geojson} />
          </div>
          {gfw ? (
            <div className="mt-3 text-sm text-neutral-300">
              <p>
                Pérdida arbórea ≥ 2021:{' '}
                <span className={gfw.totalLossHa === 0 ? 'text-brand' : 'text-red-400'}>
                  {gfw.totalLossHa} ha
                </span>
              </p>
              <p className="text-xs text-neutral-500">
                {gfw.criterio} · consultado{' '}
                {gfw.checkedAt ? new Date(gfw.checkedAt).toLocaleString('es-AR') : '—'}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">Sin consulta GFW registrada.</p>
          )}
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-5">
          <h2 className="text-lg font-semibold">Hashes y documentos</h2>
          <div className="mt-3">
            <HashLinea etiqueta="renspa_doc_hash" valor={lote.renspa_doc_hash} />
            <HashLinea etiqueta="rfid_list_hash" valor={lote.rfid_list_hash} />
            <HashLinea etiqueta="eudr_geo_hash" valor={lote.eudr_geo_hash} />
            <HashLinea etiqueta="ada_hash (Sello 2)" valor={auditorias[0]?.acta_hash} />
            <HashLinea etiqueta="dte_pdf_hash" valor={recepciones[0]?.dte_hash} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {renspaUrl && (
              <a
                className="text-brand hover:text-brand/80"
                href={renspaUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ver constancia RENSPA ↗
              </a>
            )}
            {boletoUrl && (
              <a
                className="text-brand hover:text-brand/80"
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
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-950/60 p-5">
        <details>
          <summary className="cursor-pointer text-lg font-semibold">
            Caravanas RFID ({caravanas.length})
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-neutral-500">
                <tr>
                  <th className="py-1.5 pr-4">RFID</th>
                  <th className="py-1.5 pr-4">Peso inicial</th>
                  <th className="py-1.5 pr-4">Peso mes 4</th>
                  <th className="py-1.5 pr-4">Peso final</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {(
                  caravanas as {
                    id: string;
                    rfid: string;
                    peso_inicial_kg: number | null;
                    peso_mes4_kg: number | null;
                    peso_final_kg: number | null;
                  }[]
                ).map((caravana) => (
                  <tr key={caravana.id} className="border-t border-neutral-900">
                    <td className="py-1.5 pr-4">{caravana.rfid}</td>
                    <td className="py-1.5 pr-4">{caravana.peso_inicial_kg ?? '—'} kg</td>
                    <td className="py-1.5 pr-4">{caravana.peso_mes4_kg ?? '—'}</td>
                    <td className="py-1.5 pr-4">{caravana.peso_final_kg ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-5">
          <h2 className="text-lg font-semibold">Escrow</h2>
          <p className="mt-2 text-sm text-neutral-300">
            Monto total: {lote.moneda}{' '}
            {Number(lote.monto_total_financiacion ?? 0).toLocaleString('es-AR')} · liberado:{' '}
            {lote.moneda} {liberado.toLocaleString('es-AR')}
          </p>
          <table className="mt-3 w-full text-left text-xs">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-1.5 pr-4">Movimiento</th>
                <th className="py-1.5 pr-4">Monto</th>
                <th className="py-1.5 pr-4">Tx</th>
              </tr>
            </thead>
            <tbody>
              {(
                movimientos as {
                  id: string;
                  tipo: string;
                  monto: number;
                  moneda: string;
                  tx_hash: string | null;
                }[]
              ).map((movimiento) => (
                <tr key={movimiento.id} className="border-t border-neutral-900">
                  <td className="py-1.5 pr-4">{movimiento.tipo}</td>
                  <td className="py-1.5 pr-4 font-mono">
                    {movimiento.moneda} {Number(movimiento.monto).toLocaleString('es-AR')}
                  </td>
                  <td className="py-1.5 pr-4">
                    <TxLink etiqueta="ver" txHash={movimiento.tx_hash} />
                  </td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-neutral-500">
                    Sin movimientos todavía (se fondea en el Paso 2).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-5">
          <h2 className="text-lg font-semibold">Productor y trazabilidad</h2>
          <div className="mt-2 space-y-1 text-sm text-neutral-300">
            <p>
              Productor:{' '}
              {productor?.nombre_razon_social ??
                (lote.productor_wallet && esWalletStellar(String(lote.productor_wallet))
                  ? String(lote.productor_wallet)
                  : 'Productor registrado')}
              {productor?.cuit ? ` · CUIT ${productor.cuit}` : ''}
            </p>
            <p className="font-mono text-xs text-neutral-500">
              {lote.productor_wallet && esWalletStellar(String(lote.productor_wallet))
                ? String(lote.productor_wallet)
                : 'Wallet pendiente de vinculación en Freighter'}
            </p>
            <p className="text-xs text-neutral-500">
              {lote.cantidad_cabezas} cabezas · {lote.peso_promedio_kg} kg promedio (
              {lote.peso_min_kg}–{lote.peso_max_kg}) · {lote.uniformidad}
            </p>
            <p className="text-xs text-neutral-500">
              Auditorías veterinarias: {auditorias.length} · Recepciones: {recepciones.length}{' '}
              (Pasos 3 y 4)
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
