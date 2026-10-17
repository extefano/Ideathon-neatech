import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SeccionLotes } from '@/components/seccion-lotes';
import { Aviso } from '@/components/ui/aviso';
import { getCurrentUser, type PerfilUsuario } from '@/lib/auth';
import {
  listarComprasDeComprador,
  listarLotesDeProductor,
  listarLotesPendientesAuditoria,
  listarLotesRevisadosPorVeterinario,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

const botonPrimario =
  'rounded-control focus-visible:ring-foco text-neutral-950 inline-flex min-h-11 items-center rounded bg-brand px-4 py-2 text-sm font-semibold hover:bg-brand/90 focus-visible:ring-2 focus-visible:outline-none';
const botonSecundario =
  'rounded-control focus-visible:ring-foco text-texto border-borde-fuerte bg-panel inline-flex min-h-11 items-center rounded border px-4 py-2 text-sm font-semibold hover:border-texto-tenue hover:bg-panel-elevado focus-visible:ring-2 focus-visible:outline-none';

async function cargar<T>(fn: () => Promise<T[]>): Promise<{ datos: T[]; error: boolean }> {
  try {
    return { datos: await fn(), error: false };
  } catch (error) {
    console.error('Error cargando lotes', error);
    return { datos: [], error: true };
  }
}

function ErrorCarga() {
  return (
    <Aviso variante="error" titulo="No pudimos cargar los lotes">
      Volvé a intentar en unos segundos.
    </Aviso>
  );
}

async function VistaProductor({ user }: { user: PerfilUsuario }) {
  const { datos: lotes, error } = await cargar(() =>
    listarLotesDeProductor({ productorId: user.productor_id, wallet: user.wallet }),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Tus lotes</h1>
        <p className="text-texto-suave max-w-3xl">
          Cargá lotes nuevos y seguí el estado de cada uno: origen libre de deforestación (Eje 1 ·
          EUDR), engorde, cierre y sus certificaciones comerciales voluntarias (Eje 2 · Valor
          agregado). Cuando un lote queda disponible, aparece en el mercado para que un comprador lo
          financie.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/lotes/nuevo" className={botonPrimario}>
          Registrar lote
          <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
        </Link>
        <Link href="/mercado" className={botonSecundario}>
          Ver el mercado
        </Link>
      </div>

      {error ? (
        <ErrorCarga />
      ) : (
        <SeccionLotes
          etiquetaAccesible="Tus lotes"
          lotes={lotes}
          perspectiva="PRODUCTOR"
          vacioTitulo="Todavía no registraste lotes"
          vacioTexto="Empezá cargando tu primer lote con “Registrar lote”."
        />
      )}
    </main>
  );
}

async function VistaVeterinario({ user }: { user: PerfilUsuario }) {
  const [pendientes, revisados] = await Promise.all([
    cargar(listarLotesPendientesAuditoria),
    cargar(() => listarLotesRevisadosPorVeterinario(user.wallet)),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Tus revisiones</h1>
        <p className="text-texto-suave max-w-3xl">
          Revisá la auditoría del Mes 4 —acta SIGSA, pesada RFID y validación del ADPV— de los lotes
          ya financiados. Abajo quedan los que todavía esperan tu firma y los que ya revisaste.
        </p>
      </header>

      {pendientes.error || revisados.error ? (
        <ErrorCarga />
      ) : (
        <>
          <SeccionLotes
            titulo={`Lotes para revisar (${pendientes.datos.length})`}
            descripcion="Financiados y sin Sello 2: falta tu auditoría del Mes 4."
            lotes={pendientes.datos}
            perspectiva="VETERINARIO"
            vacioTitulo="No hay auditorías pendientes"
            vacioTexto="Cuando un lote quede financiado y necesite el Sello 2, va a aparecer acá."
          />
          <SeccionLotes
            titulo={`Lotes que revisaste (${revisados.datos.length})`}
            descripcion="Auditorías del Mes 4 que ya firmaste."
            lotes={revisados.datos}
            perspectiva="VETERINARIO"
            vacioTitulo="Todavía no revisaste lotes"
            vacioTexto="Los lotes que audites van a quedar listados acá."
          />
        </>
      )}
    </main>
  );
}

async function VistaComprador({ user }: { user: PerfilUsuario }) {
  const { datos: compras, error } = await cargar(() => listarComprasDeComprador(user.wallet));

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Tus compras</h1>
        <p className="text-texto-suave max-w-3xl">
          Lotes que financiaste y su avance (40 % al inicio, 30 % a mitad del engorde y 30 % en la
          entrega). Para fondear un lote nuevo, entrá al mercado.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/mercado" className={botonPrimario}>
          Ir al mercado
          <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
        </Link>
      </div>

      {error ? (
        <ErrorCarga />
      ) : (
        <SeccionLotes
          etiquetaAccesible="Tus compras"
          lotes={compras}
          perspectiva="COMPRADOR"
          vacioTitulo="Todavía no financiaste lotes"
          vacioTexto="Andá al mercado para depositar el pago en garantía de un lote disponible."
        />
      )}
    </main>
  );
}

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect('/mercado');

  if (user.rol === 'PRODUCTOR') return <VistaProductor user={user} />;
  if (user.rol === 'VETERINARIO') return <VistaVeterinario user={user} />;
  return <VistaComprador user={user} />;
}
