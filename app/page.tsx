import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SeccionLotes } from '@/components/seccion-lotes';
import { Aviso } from '@/components/ui/aviso';
import { getCurrentUser, type PerfilUsuario } from '@/lib/auth';
import {
  listarComprasDeComprador,
  listarLotesDeProductor,
  listarLotesEnTransitoFrigorifico,
  listarLotesListosDespachoFrigorifico,
  listarLotesPendientesAuditoria,
  listarLotesRecepcionadosFrigorifico,
  listarLotesRevisadosPorVeterinario,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

const botonPrimario =
  'rounded-control focus-visible:ring-foco text-neutral-950 inline-flex items-center justify-center rounded-md bg-brand px-3 py-1.5 text-xs font-semibold hover:bg-brand/90 transition-colors focus-visible:ring-2 focus-visible:outline-none';
const botonSecundario =
  'rounded-control focus-visible:ring-foco text-texto border-borde-fuerte bg-panel inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium hover:border-texto-tenue hover:bg-panel-elevado transition-colors focus-visible:ring-2 focus-visible:outline-none';

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
    <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-texto text-2xl font-bold tracking-tight md:text-3xl">Tus lotes</h1>
          <p className="text-texto-suave max-w-2xl text-sm">
            Registrá lotes nuevos y seguí su validación satelital, auditoría sanitaria y cierre de
            ciclo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/mercado" className={botonSecundario}>
            Ver mercado
          </Link>
          <Link href="/lotes/nuevo" className={botonPrimario}>
            Registrar lote
            <ArrowRight aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

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
    <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-texto text-2xl font-bold tracking-tight md:text-3xl">
            Tus revisiones
          </h1>
          <p className="text-texto-suave max-w-2xl text-sm">
            Certificá la auditoría del Mes 4 (acta SIGSA, pesada RFID y ganancia de peso) en lotes
            financiados.
          </p>
        </div>
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
    <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-texto text-2xl font-bold tracking-tight md:text-3xl">Tus compras</h1>
          <p className="text-texto-suave max-w-2xl text-sm">
            Seguimiento de los lotes que financiaste, su avance sanitario y certificados de
            exportación.
          </p>
        </div>

        <Link href="/mercado" className={botonPrimario}>
          Ir al mercado
          <ArrowRight aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
        </Link>
      </header>

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

async function VistaFrigorifico({ user: _user }: { user: PerfilUsuario }) {
  const [enTransito, listosDespacho, recepcionados] = await Promise.all([
    cargar(listarLotesEnTransitoFrigorifico),
    cargar(listarLotesListosDespachoFrigorifico),
    cargar(listarLotesRecepcionadosFrigorifico),
  ]);

  const hayError = enTransito.error || listosDespacho.error || recepcionados.error;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-texto text-2xl font-bold tracking-tight md:text-3xl">
            Panel de recepciones
          </h1>
          <p className="text-texto-suave max-w-2xl text-sm">
            Registrá en balanza fiscal los lotes en tránsito, conciliá caravanas RFID y emití el
            Sello 3 de cierre.
          </p>
        </div>

        <Link href="/mercado" className={botonSecundario}>
          Ver mercado
        </Link>
      </header>

      {hayError ? (
        <ErrorCarga />
      ) : (
        <>
          <SeccionLotes
            titulo={`Lotes en tránsito a planta (${enTransito.datos.length})`}
            descripcion="Con despacho DT-e emitido en origen. Listos para cargar pesada de balanza fiscal y emitir Sello 3."
            lotes={enTransito.datos}
            perspectiva="FRIGORIFICO"
            vacioTitulo="No hay lotes en tránsito"
            vacioTexto="Cuando un productor despache hacienda con DT-e, va a figurar acá para su recepción."
          />
          <SeccionLotes
            titulo={`Próximos a despacho (${listosDespacho.datos.length})`}
            descripcion="Lotes en engorde con auditoría sanitaria (Sello 2) aprobada, a la espera del DT-e del productor."
            lotes={listosDespacho.datos}
            perspectiva="FRIGORIFICO"
            vacioTitulo="No hay lotes próximos a despacho"
            vacioTexto="Los lotes que finalicen la auditoría del Mes 4 van a listarse acá antes de su traslado."
          />
          <SeccionLotes
            titulo={`Recepciones cerradas (${recepcionados.datos.length})`}
            descripcion="Lotes faenados con Sello 3 emitido y pasaporte EUDR disponible."
            lotes={recepcionados.datos}
            perspectiva="FRIGORIFICO"
            vacioTitulo="Todavía no se cerraron recepciones"
            vacioTexto="Las recepciones que confirmes en balanza fiscal con Sello 3 van a quedar registradas acá."
          />
        </>
      )}
    </main>
  );
}

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect('/mercado');

  if (user.rol === 'PRODUCTOR') return <VistaProductor user={user} />;
  if (user.rol === 'VETERINARIO') return <VistaVeterinario user={user} />;
  if (user.rol === 'FRIGORIFICO') return <VistaFrigorifico user={user} />;
  return <VistaComprador user={user} />;
}
