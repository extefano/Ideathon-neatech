import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { MapaPasaporte } from '@/components/mapa-lote';
import { Aviso } from '@/components/ui/aviso';
import { CopiaHash } from '@/components/ui/copia-hash';
import { Tabla } from '@/components/ui/tabla';
import { Tarjeta } from '@/components/ui/tarjeta';
import { VerificadorIntegridad } from '@/components/verificador-integridad';
import { construirDocumentos } from '@/lib/documentos-hashes';
import { getLoteCompleto } from '@/lib/queries';
import { esWalletStellar } from '@/lib/stellar-args';

export const dynamic = 'force-dynamic';

function mostrarWalletPublica(wallet: unknown): string {
  if (typeof wallet === 'string' && esWalletStellar(wallet)) return wallet;
  return 'Cuenta verificada (testnet)';
}

function fecha(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR');
}

function TxLink({ txHash }: { txHash: unknown }) {
  if (typeof txHash !== 'string' || txHash.length === 0)
    return <span className="text-texto-tenue">—</span>;
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
      target="_blank"
      rel="noreferrer"
      className="focus-visible:ring-foco text-brand-fuerte font-mono text-xs hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      {txHash.slice(0, 12)}… ↗
    </a>
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

  const documentos = construirDocumentos({
    renspaDocHash: lote.renspa_doc_hash,
    rfidListHash: lote.rfid_list_hash,
    eudrGeoHash: lote.eudr_geo_hash,
    actaHash: auditoria?.acta_hash,
    dteHash: recepcion?.dte_hash,
  });

  const hashesAuditor = documentos
    .filter((documento) => documento.hash)
    .map((documento) => ({ etiqueta: documento.titulo, hash: documento.hash as string }));

  const timeline = [
    {
      titulo: 'Sello 1 · Origen libre de deforestación',
      fecha: fecha(lote.created_at),
      detalle: `${gfw?.totalLossHa ?? 0} ha de pérdida de bosque posterior a 2020 · padrón RFID y RENSPA anclados.`,
      tx: lote.soroban_create_tx_hash,
    },
    {
      titulo: 'Sello 2 · Sanidad y engorde',
      fecha: fecha(auditoria?.created_at),
      detalle: `Auditoría del Mes 4 firmada por ${auditoria?.vet_nombre ?? 'el Veterinario acreditado'} · ADPV ${lote.adpv_kg_dia ?? '—'} kg/día (rango INTA 0,5–1,3).`,
      tx: lote.soroban_seal2_tx_hash,
    },
    {
      titulo: 'Sello 3 · Cierre y recepción',
      fecha: fecha(recepcion?.created_at),
      detalle: `${recepcion?.cabezas_recibidas ?? '—'} cabezas recibidas · peso final promedio ${recepcion?.peso_final_promedio_kg ?? '—'} kg.`,
      tx: lote.soroban_seal3_tx_hash,
    },
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6 sm:p-8">
      <header className="rounded-tarjeta border-brand-fuerte/40 bg-brand/5 border p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-brand-fuerte text-xs font-semibold tracking-widest uppercase">
              Lote certificado EUDR · 3/3 sellos verificados en Stellar Soroban (testnet)
            </p>
            <h1 className="mt-2 text-3xl font-bold">{lote.codigo_lote}</h1>
            <p className="mt-1 text-lg">{lote.titulo}</p>
            <p className="text-texto-suave mt-2 text-sm">
              Origen: {productor?.nombre_razon_social ?? '—'} — {lote.localidad}, {lote.provincia},
              Argentina · trazabilidad completa.
            </p>
          </div>
          <div className="text-center">
            <img
              src={qrDataUrl}
              alt={`QR del pasaporte del lote ${lote.codigo_lote}`}
              width={160}
              height={160}
              className="mx-auto rounded bg-white p-2"
            />
            <a
              href={qrDataUrl}
              download={`${codigo}-qr.png`}
              className="focus-visible:ring-foco text-brand-fuerte mt-2 block text-xs hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Descargar QR
            </a>
          </div>
        </div>
      </header>

      <Tarjeta titulo="Historia del lote" descripcion="Del origen al cierre, paso a paso.">
        <ol className="space-y-4">
          {timeline.map((hito, indice) => (
            <li key={hito.titulo} className="flex gap-3">
              <span
                aria-hidden="true"
                className="bg-brand flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-neutral-950"
              >
                {indice + 1}
              </span>
              <div>
                <p className="text-texto text-sm font-semibold">{hito.titulo}</p>
                <p className="text-texto-tenue text-xs">{hito.fecha}</p>
                <p className="text-texto-suave mt-1 text-sm">{hito.detalle}</p>
              </div>
            </li>
          ))}
        </ol>
      </Tarjeta>

      <section className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Ubicación del establecimiento">
          <div className="rounded-tarjeta border-borde overflow-hidden border">
            <MapaPasaporte poligono={lote.poligono_geojson} />
          </div>
          <a
            href={geoDataUri}
            download={`${codigo}.geojson`}
            className="focus-visible:ring-foco text-brand-fuerte mt-3 inline-block text-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Descargar polígono GeoJSON (para TRACES UE)
          </a>
        </Tarjeta>

        <Tarjeta titulo="Entrega y liquidación">
          <ul className="text-texto-suave space-y-2 text-sm">
            <li>
              Cabezas recibidas: <strong>{recepcion?.cabezas_recibidas ?? '—'}</strong> · peso final
              promedio {recepcion?.peso_final_promedio_kg ?? '—'} kg
            </li>
            <li>
              Pago en garantía: {lote.moneda}{' '}
              {Number(lote.monto_total_financiacion ?? 0).toLocaleString('es-AR')} · liberado:{' '}
              {lote.moneda} {liberado.toLocaleString('es-AR')}
            </li>
            <li>
              Ajuste por kilos: {lote.moneda}{' '}
              {Number(recepcion?.ajuste_usdc ?? 0).toLocaleString('es-AR')}
            </li>
          </ul>
        </Tarjeta>
      </section>

      <Tarjeta titulo="Detalles técnicos verificables">
        <details>
          <summary className="text-texto cursor-pointer text-sm font-semibold">
            Hashes, transacciones y actores
          </summary>

          <div className="mt-4 space-y-5">
            <div>
              <h3 className="text-texto text-sm font-semibold">Documentos y hashes SHA-256</h3>
              <ul className="mt-2 space-y-2">
                {documentos.map((documento) => (
                  <li
                    key={documento.clave}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="text-texto-suave text-sm">{documento.titulo}</span>
                    {documento.hash ? (
                      <CopiaHash valor={documento.hash} />
                    ) : (
                      <span className="text-texto-tenue text-xs">{documento.pendiente}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-texto text-sm font-semibold">Transacciones en Stellar</h3>
              <ul className="mt-2 space-y-1 text-xs">
                <li>
                  Sello 1: <TxLink txHash={lote.soroban_create_tx_hash} />
                </li>
                <li>
                  Fondeo: <TxLink txHash={lote.soroban_fund_tx_hash} />
                </li>
                <li>
                  Sello 2: <TxLink txHash={lote.soroban_seal2_tx_hash} />
                </li>
                <li>
                  Sello 3: <TxLink txHash={lote.soroban_seal3_tx_hash} />
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-texto text-sm font-semibold">Actores y wallets</h3>
              <ul className="text-texto-suave mt-2 space-y-1 text-sm">
                <li>
                  Productor:{' '}
                  <span className="text-texto-suave font-mono text-xs">
                    {mostrarWalletPublica(lote.productor_wallet)}
                  </span>
                </li>
                <li>
                  Veterinario acreditado: {auditoria?.vet_nombre ?? '—'} (
                  {auditoria?.matricula ?? '—'}) ·{' '}
                  <span className="text-texto-suave font-mono text-xs">
                    {mostrarWalletPublica(auditoria?.vet_wallet)}
                  </span>
                </li>
                <li>
                  Frigorífico:{' '}
                  <span className="text-texto-suave font-mono text-xs">
                    {mostrarWalletPublica(lote.comprador_wallet)}
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-texto text-sm font-semibold">
                Trazabilidad individual por caravana
              </h3>
              <Tabla
                className="mt-2"
                columnas={[
                  { clave: 'rfid', titulo: 'Caravana RFID' },
                  { clave: 'inicial', titulo: 'Paso 1', numerica: true },
                  { clave: 'mes4', titulo: 'Mes 4', numerica: true },
                  { clave: 'final', titulo: 'Final', numerica: true },
                ]}
                vacio="Sin caravanas registradas."
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
          </div>
        </details>
      </Tarjeta>

      <VerificadorIntegridad hashes={hashesAuditor} />

      <Aviso variante="info">
        Los documentos originales completos (RENSPA, acta SIGSA, DT-e) quedan bajo acceso controlado
        de las partes del contrato y auditores habilitados. En Stellar solo se anclan hashes y
        eventos; un hash detecta alteraciones, no prueba la veracidad del contenido.
      </Aviso>

      <p className="text-texto-tenue text-center text-xs">
        Pasaporte generado por Muunar ·{' '}
        <Link
          href={`/lotes/${codigo}`}
          className="focus-visible:ring-foco text-brand-fuerte hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          ver ficha interna
        </Link>{' '}
        · {urlPublica}
      </p>
    </main>
  );
}
