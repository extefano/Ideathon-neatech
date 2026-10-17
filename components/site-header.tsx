import Image from 'next/image';
import Link from 'next/link';
import { getCurrentUser, logoutAction, type RolUsuario } from '@/lib/auth';

function BadgeRol({ rol }: { rol: RolUsuario }) {
  const etiqueta =
    rol === 'PRODUCTOR' ? 'Productor' : rol === 'VETERINARIO' ? 'Veterinario' : 'Comprador';
  return (
    <span className="text-brand rounded border border-neutral-950 bg-neutral-950 px-2 py-0.5 text-xs font-semibold tracking-wider uppercase">
      {etiqueta}
    </span>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  const puedeRegistrar = !user || user.rol === 'PRODUCTOR';

  return (
    <header className="bg-brand border-b-4 border-neutral-950 text-neutral-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="focus-visible:ring-foco flex items-center gap-2.5 rounded focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Muunar — inicio"
          >
            <Image
              src="/brand/muunar-isotipo-negro.svg"
              alt=""
              width={565}
              height={560}
              priority
              className="h-10 w-auto"
            />
            <span className="text-2xl font-bold tracking-tight text-neutral-950">Muunar</span>
          </Link>

          <nav
            className="flex flex-wrap items-center gap-1 sm:gap-2"
            aria-label="Navegación principal"
          >
            <Link
              href="/mercado"
              className="focus-visible:ring-foco rounded-control px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-950/10 focus-visible:ring-2 focus-visible:outline-none"
            >
              Mercado
            </Link>
            {puedeRegistrar && (
              <Link
                href="/lotes/nuevo"
                className="focus-visible:ring-foco rounded-control px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-950/10 focus-visible:ring-2 focus-visible:outline-none"
              >
                Registrar lote
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="text-brand flex h-8 w-8 items-center justify-center rounded-full border border-neutral-950 bg-neutral-950 text-xs font-semibold"
                  title={user.nombre_completo}
                >
                  {iniciales(user.nombre_completo)}
                </div>
                <div className="hidden flex-col sm:flex">
                  <span className="max-w-[180px] truncate text-xs font-bold text-neutral-950">
                    {user.nombre_completo}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-800">CUIT {user.cuit}</span>
                </div>
              </div>

              <BadgeRol rol={user.rol} />

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="focus-visible:ring-foco hover:text-brand cursor-pointer rounded border border-neutral-950 bg-transparent px-2.5 py-1 text-xs font-semibold text-neutral-950 transition-colors hover:bg-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="focus-visible:ring-foco rounded border border-neutral-950 bg-transparent px-3 py-1.5 text-xs font-semibold text-neutral-950 transition-colors hover:bg-neutral-950/10 focus-visible:ring-2 focus-visible:outline-none"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/login?tab=register"
                className="focus-visible:ring-foco text-brand rounded bg-neutral-950 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-neutral-900 focus-visible:ring-2 focus-visible:outline-none"
              >
                Registrar
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
