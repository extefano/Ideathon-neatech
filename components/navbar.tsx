import Link from 'next/link';
import { getCurrentUser, logoutAction, type RolUsuario } from '@/lib/auth';

function BadgeRol({ rol }: { rol: RolUsuario }) {
  if (rol === 'PRODUCTOR') {
    return (
      <span className="rounded bg-yellow-400 px-2 py-0.5 text-xs font-bold tracking-wider text-black uppercase">
        Productor
      </span>
    );
  }
  if (rol === 'VETERINARIO') {
    return (
      <span className="rounded border border-yellow-400 px-2 py-0.5 text-xs font-semibold tracking-wider text-yellow-400 uppercase">
        Veterinario
      </span>
    );
  }
  return (
    <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold tracking-wider text-white uppercase">
      Comprador
    </span>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export async function Navbar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-bold text-neutral-100 hover:text-white"
          >
            <span className="font-black text-yellow-400">◆</span> NEATECH
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-neutral-400 sm:flex">
            <Link href="/" className="transition-colors hover:text-neutral-200">
              Inicio
            </Link>
            <Link href="/mercado" className="transition-colors hover:text-neutral-200">
              Marketplace
            </Link>
            <Link href="/lotes/nuevo" className="transition-colors hover:text-yellow-400">
              Registrar lote
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-xs font-semibold text-yellow-400"
                  title={user.nombre_completo}
                >
                  {iniciales(user.nombre_completo)}
                </div>
                <div className="hidden flex-col sm:flex">
                  <span className="max-w-[180px] truncate text-xs font-medium text-neutral-200">
                    {user.nombre_completo}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-500">CUIT {user.cuit}</span>
                </div>
              </div>

              <BadgeRol rol={user.rol} />

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="cursor-pointer rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/login?tab=register"
                className="rounded bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-yellow-300"
              >
                Crear cuenta
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
