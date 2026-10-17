import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { BannerRolRequerido, CredencialSesion } from '@/components/auth-guard';
import { Aviso } from '@/components/ui/aviso';
import { Pasos } from '@/components/ui/pasos';
import { Tarjeta } from '@/components/ui/tarjeta';
import { getCurrentUser } from '@/lib/auth';
import { calcularDesembolsos } from '@/lib/escrow';
import { getLoteCompleto } from '@/lib/queries';
import { FormDespacho, FormRecepcion } from './form-recepcion';

export const dynamic = 'force-dynamic';

const PASOS_CIERRE = [
  { titulo: '4A Despacho', descripcion: 'DT-e en origen (Productor)' },
  { titulo: '4B Recepción', descripcion: 'Balanza fiscal (Frigorífico)' },
  { titulo: 'Cierre', descripcion: 'Sello 3 y pasaporte' },
];

export default async function RecepcionPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const user = await getCurrentUser();
  const data = await getLoteCompleto(codigo);
  const lote = data?.lote;

  if (!lote) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p>Lote no encontrado.</p>
      </main>
    );
  }

  const volver = (
    <Link
      href={`/lotes/${codigo}`}
      className="focus-visible:ring-foco hover:text-brand-fuerte text-texto-suave inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Volver a la ficha
    </Link>
  );

  const puedeDespachar =
    lote.estado_publicacion === 'FINANCIADO_EN_ENGORDE' && Boolean(lote.seal_2_sanitary);
  const puedeRecepcionar = lote.estado_publicacion === 'EN_TRANSITO_A_FRIGORIFICO';
  const cerrado = lote.estado_publicacion === 'CERRADO_CICLO';

  const esProductor = user?.rol === 'PRODUCTOR';
  const esComprador = user?.rol === 'COMPRADOR';

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      {volver}
      <div>
        <h1 className="text-3xl font-bold">Cierre de ciclo — Paso 4</h1>
        <p className="text-texto-suave mt-2 text-sm">
          {lote.codigo_lote} · {lote.titulo} · objetivo {lote.peso_objetivo_kg} kg
        </p>
      </div>

      <Pasos pasos={PASOS_CIERRE} actual={cerrado ? 3 : puedeRecepcionar ? 1 : 0} />

      {puedeDespachar && (
        <Tarjeta
          titulo="4A — Despacho en origen"
          descripcion="Esta parte la completa el Productor: emití el DT-e y adjuntá el PDF antes de que salga el camión."
        >
          {!esProductor ? (
            <BannerRolRequerido
              rolRequerido="PRODUCTOR"
              titulo="El despacho DT-e requiere cuenta de Productor"
              descripcion="Solo el Productor titular del establecimiento de origen puede emitir y adjuntar el DT-e de salida."
              userActual={user}
              redirectTo={`/lotes/${codigo}/recepcion`}
            />
          ) : (
            <div className="space-y-4">
              <CredencialSesion user={user} />
              <FormDespacho codigo={codigo} user={user} />
            </div>
          )}
        </Tarjeta>
      )}

      {puedeRecepcionar && (
        <Tarjeta
          titulo="4B — Recepción en balanza fiscal"
          descripcion="Esta parte la completa el Frigorífico: cargá el CSV de balanza, se concilian las caravanas y se cierra el ciclo con el Sello 3."
        >
          {!esComprador ? (
            <BannerRolRequerido
              rolRequerido="COMPRADOR"
              titulo="La recepción requiere cuenta de Comprador"
              descripcion="Solo el Comprador o frigorífico de destino puede cargar el pesaje de balanza fiscal y liquidar el cierre del ciclo."
              userActual={user}
              redirectTo={`/lotes/${codigo}/recepcion`}
            />
          ) : (
            <div className="space-y-4">
              <CredencialSesion user={user} />
              <FormRecepcion
                codigo={codigo}
                user={user}
                productorWallet={lote.productor_wallet ?? undefined}
                montoHito3Usdc={
                  calcularDesembolsos(Number(lote.monto_total_financiacion ?? 0)).hito3
                }
              />
            </div>
          )}
        </Tarjeta>
      )}

      <Aviso variante="info" titulo="Cómo se liquida el pago final">
        Se libera el 30 % restante. Si faltan kilos respecto del objetivo, se descuenta en
        proporción y ese monto se reembolsa al Comprador.
      </Aviso>

      {cerrado && (
        <Tarjeta titulo="Ciclo cerrado">
          <p className="text-texto-suave text-sm">
            Los 3 sellos están verificados. El pasaporte EUDR público ya está disponible.
          </p>
          <Link
            href={`/pasaporte/${lote.codigo_lote}`}
            className="rounded-control focus-visible:ring-foco bg-brand mt-3 inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Ver pasaporte EUDR
            <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" />
          </Link>
        </Tarjeta>
      )}

      {!puedeDespachar && !puedeRecepcionar && !cerrado && (
        <Aviso variante="alerta" titulo="Sin acciones de cierre disponibles">
          Este lote no tiene acciones de cierre en su estado actual.
        </Aviso>
      )}
    </main>
  );
}
