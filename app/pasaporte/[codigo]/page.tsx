import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { MapaPasaporte } from '@/components/mapa-lote';
import { VerificadorIntegridad } from '@/components/verificador-integridad';
import { getLoteCompleto } from '@/lib/queries';

export const dynamic = 'force-dynamic';

function TxLink({ txHash }: { txHash: unknown }) {
  if (typeof txHash !== 'string' || txHash.length === 0)
    return <span className="text-neutral-600">—</span>;
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs text-sky-400 hover:text-sky-300"
    >
      {txHash.slice(0, 12)}… ↗
    </a>
  );
}

function HashCorto({ valor }: { valor: unknown }) {
  if (typeof valor !== 'string' || valor.length === 0)
    return <span className="text-neutral-600">—</span>;
  return (
    <span className="font-mono text-xs text-neutral-400" title={valor}>
      {valor.slice(0, 16)}…
    </span>
  );
}

export default async function PasaportePage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const data = await getLoteCompleto(codigo);

  if (!data || !data.lote.seal_3_reception) notFound();

  const { lote, caravanas, movimientos, auditorias, recepciones, productor } = data;
  const auditoria = auditorias[0] ?? null;
  const recepcion = recepciones[0] ?? null;
  const gfw = (lote.gfw_consulta ?? null) as { totalLossHa?: number; checkedAt?: string } | null;

  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https';
  const urlPublica = `${proto}://${host}/pasaporte/${codigo}`;
  const qrDataUrl = await QRCode.toDataURL(urlPublica, {
    margin: 1,
    width: 320,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const geoJsonStr = JSON.stringify(lote.poligono_geojson ?? {}, null, 2);
  const geoDataUri = `data:application/geo+json;charset=utf-8,${encodeURIComponent(geoJsonStr)}`;

  const liberado = (movimientos as { tipo: string; monto: number }[])
    .filter((m) => m.tipo.startsWith('RELEASE_'))
    .reduce((a, m) => a + Number(m.monto), 0);

  const hashesAuditor = [
    { etiqueta: 'renspa_doc_hash', hash: String(lote.renspa_doc_hash ?? '') },
    { etiqueta: 'vaccination_acta_hash', hash: String(auditoria?.acta_hash ?? '') },
    { etiqueta: 'dte_pdf_hash', hash: String(recepcion?.dte_hash ?? '') },
  ].filter((h2) => h2.hash.length > 0);

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <header className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
              Lote certificado EUDR — 3/3 sellos verificados en Stellar Soroban (testnet)
            </p>
            <h1 className="mt-2 text-3xl font-bold">{lote.codigo_lote}</h1>
            <p className="mt-1 text-lg">{lote.titulo}</p>
            <p className="mt-2 text-sm text-neutral-400">
              RENSPA {lote.renspa} — {lote.localidad}, {lote.provincia}, Argentina ·{' '}
              {gfw?.totalLossHa === 0
                ? '0.00 ha de pérdida arbórea ≥ 2021'
                : 'revisar evaluación EUDR'}{' '}
              · ciclo cerrado
            </p>
          </div>
          <div className="text-center">
            <img
              src={qrDataUrl}
              alt="QR del pasaporte EUDR"
              width={160}
              height={160}
              className="mx-auto rounded bg-white p-2"
            />
            <a
              href={qrDataUrl}
              download={`${codigo}-qr.png`}
              className="mt-2 block text-xs text-emerald-400 hover:text-emerald-300"
            >
              Descargar QR
            </a>
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-5">
          <h2 className="text-lg font-semibold">Actores intervinientes</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <span className="text-neutral-500">Productor de origen:</span>{' '}
              {productor?.nombre_razon_social ?? '—'} ·{' '}
              <span className="font-mono text-xs">{lote.productor_wallet}</span>
            </li>
            <li>
              <span className="text-neutral-500">Oráculo ambiental (Paso 1):</span> backend de la
              plataforma (consulta GFW real,{' '}
              {gfw?.checkedAt ? new Date(gfw.checkedAt).toLocaleDateString('es-AR') : '—'})
            </li>
            <li>
              <span className="text-neutral-500">Veterinario acreditado (Paso 3):</span>{' '}
              {auditoria?.vet_nombre ?? '—'} · {auditoria?.matricula ?? '—'} ·{' '}
              <span className="font-mono text-xs">{auditoria?.vet_wallet ?? '—'}</span>
            </li>
            <li>
              <span className="text-neutral-500">Frigorífico exportador (Pasos 2 y 4):</span>{' '}
              <span className="font-mono text-xs">{lote.comprador_wallet ?? '—'}</span>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-5">
          <h2 className="text-lg font-semibold">Entrega y liquidación</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <span className="text-neutral-500">Cabezas recibidas:</span>{' '}
              {recepcion?.cabezas_recibidas ?? '—'} · peso final promedio{' '}
              {recepcion?.peso_final_promedio_kg ?? '—'} kg
            </li>
            <li>
              <span className="text-neutral-500">Escrow:</span> {lote.moneda}{' '}
              {Number(lote.monto_total_financiacion ?? 0).toLocaleString('es-AR')} depositados ·{' '}
              {lote.moneda} {liberado.toLocaleString('es-AR')} liberados
              {Number(recepcion?.ajuste_usdc ?? 0) > 0
                ? ` · ajuste por kilos: ${lote.moneda} ${Number(recepcion?.ajuste_usdc).toLocaleString('es-AR')}`
                : ' (sin ajuste)'}
            </li>
            <li>
              <span className="text-neutral-500">Descargas:</span>{' '}
              <a
                className="text-sky-400 hover:text-sky-300"
                href={geoDataUri}
                download={`${codigo}.geojson`}
              >
                Polígono GeoJSON (para TRACES UE)
              </a>
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-5">
        <h2 className="text-lg font-semibold">Las 3 pruebas inalterables en Stellar</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-2 pr-4">Sello</th>
                <th className="py-2 pr-4">Qué certifica</th>
                <th className="py-2 pr-4">Hashes SHA-256</th>
                <th className="py-2 pr-4">Transacción (testnet)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-neutral-900">
                <td className="py-2 pr-4 font-medium text-emerald-300">1 · Origen EUDR</td>
                <td className="py-2 pr-4">
                  Polígono sin pérdida arbórea post-2020 (GFW real) + padrón RFID + RENSPA
                </td>
                <td className="py-2 pr-4">
                  <HashCorto valor={lote.eudr_geo_hash} /> ·{' '}
                  <HashCorto valor={lote.renspa_doc_hash} /> ·{' '}
                  <HashCorto valor={lote.rfid_list_hash} />
                </td>
                <td className="py-2 pr-4">
                  <TxLink txHash={lote.soroban_create_tx_hash} />
                </td>
              </tr>
              <tr className="border-t border-neutral-900">
                <td className="py-2 pr-4 font-medium text-emerald-300">2 · Sanidad y engorde</td>
                <td className="py-2 pr-4">
                  Acta SIGSA firmada por el veterinario + ADPV {String(lote.adpv_kg_dia ?? '—')}{' '}
                  kg/día (rango INTA 0,5–1,3)
                </td>
                <td className="py-2 pr-4">
                  <HashCorto valor={auditoria?.acta_hash} /> ·{' '}
                  <HashCorto valor={auditoria?.csv_mes4_hash} />
                </td>
                <td className="py-2 pr-4">
                  <TxLink txHash={lote.soroban_seal2_tx_hash} />
                </td>
              </tr>
              <tr className="border-t border-neutral-900">
                <td className="py-2 pr-4 font-medium text-emerald-300">3 · Cierre y recepción</td>
                <td className="py-2 pr-4">
                  DT-e de tránsito + recepción en balanza fiscal del frigorífico con conciliación
                  RFID
                </td>
                <td className="py-2 pr-4">
                  <HashCorto valor={recepcion?.dte_hash} /> ·{' '}
                  <HashCorto valor={recepcion?.csv_recepcion_hash} />
                </td>
                <td className="py-2 pr-4">
                  <TxLink txHash={lote.soroban_seal3_tx_hash} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-5">
        <h2 className="text-lg font-semibold">Visor geoespacial EUDR</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Polígono del establecimiento validado contra Global Forest Watch (0 ha de pérdida ≥ 2021).
        </p>
        <div className="mt-3">
          <MapaPasaporte poligono={lote.poligono_geojson} />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-5">
        <h2 className="text-lg font-semibold">Trazabilidad individual por caravana (032…)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-1.5 pr-4">Caravana RFID</th>
                <th className="py-1.5 pr-4">Paso 1</th>
                <th className="py-1.5 pr-4">Mes 4</th>
                <th className="py-1.5 pr-4">Final</th>
                <th className="py-1.5 pr-4">Δ total</th>
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
              ).map((caravana) => {
                const delta =
                  caravana.peso_final_kg != null && caravana.peso_inicial_kg != null
                    ? Math.round((caravana.peso_final_kg - caravana.peso_inicial_kg) * 10) / 10
                    : null;
                return (
                  <tr key={caravana.id} className="border-t border-neutral-900">
                    <td className="py-1.5 pr-4">{caravana.rfid}</td>
                    <td className="py-1.5 pr-4">{caravana.peso_inicial_kg ?? '—'} kg</td>
                    <td className="py-1.5 pr-4">{caravana.peso_mes4_kg ?? '—'} kg</td>
                    <td className="py-1.5 pr-4">{caravana.peso_final_kg ?? '—'} kg</td>
                    <td className="py-1.5 pr-4">{delta != null ? `+${delta} kg` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Los documentos originales completos (RENSPA, acta SIGSA, DT-e) quedan bajo acceso
          controlado de las partes del contrato y auditores habilitados. En Stellar solo se anclan
          hashes y eventos; un hash detecta alteraciones, no prueba la veracidad del contenido.
        </p>
      </section>

      <VerificadorIntegridad hashes={hashesAuditor} />

      <p className="text-center text-xs text-neutral-600">
        Pasaporte generado por Ideathon Neatech ·{' '}
        <Link href={`/lotes/${codigo}`}>ver ficha interna</Link> · {urlPublica}
      </p>
    </main>
  );
}
