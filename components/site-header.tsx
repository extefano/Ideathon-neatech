import Image from 'next/image';
import Link from 'next/link';
import { getCurrentUser, logoutAction, type RolUsuario } from '@/lib/auth';

function BadgeRol({ rol }: { rol: RolUsuario }) {
  if (rol === 'PRODUCTOR') {
    return (
      <span className="rounded bg-neutral-950 px-2 py-0.5 text-xs font-bold tracking-wider text-yellow-400 uppercase">
        Productor
      </span>
    );
  }
  if (rol === 'VETERINARIO') {
    return (
      <span className="rounded border border-neutral-950 bg-neutral-950/10 px-2 py-0.5 text-xs font-bold tracking-wider text-neutral-950 uppercase">
        Veterinario
      </span>
    );
  }
  return (
    <span className="rounded bg-neutral-900 px-2 py-0.5 text-xs font-semibold tracking-wider text-white uppercase">
      Comprador
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

  return (
    <header className="bg-brand border-b-4 border-neutral-950 text-neutral-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Muunar — inicio">
            <Image
              src="/brand/muunar-isotipo-blanco.svg"
              alt=""
              width={565}
              height={560}
              priority
              className="h-10 w-auto"
            />
            <span className="text-2xl font-bold tracking-tight text-white">Muunar</span>
          </Link>

          <nav className="hidden items-center gap-2 sm:flex">
            <Link
              href="/mercado"
              className="rounded-md px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-950/10"
            >
              Marketplace
            </Link>
            <Link
              href="/lotes/nuevo"
              className="rounded-md px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-950/10"
            >
              Registrar lote
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-950 bg-neutral-950 text-xs font-semibold text-yellow-400"
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
                  className="cursor-pointer rounded border border-neutral-950 bg-neutral-950/10 px-2.5 py-1 text-xs font-semibold text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded border border-neutral-950 bg-transparent px-3 py-1.5 text-xs font-semibold text-neutral-950 transition-colors hover:bg-neutral-950/10"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/login?tab=register"
                className="rounded bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-yellow-400 transition-colors hover:bg-neutral-900"
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
