import Link from 'next/link';
import type { PerfilUsuario, RolUsuario } from '@/lib/auth';

export function CredencialSesion({ user }: { user: PerfilUsuario }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-3 py-2 text-xs text-neutral-300">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
        <span>
          Operando como: <strong className="text-white">{user.nombre_completo}</strong> · CUIT{' '}
          <span className="font-mono text-neutral-200">{user.cuit}</span> ·{' '}
          <span className="font-semibold text-yellow-400">{user.rol}</span>
        </span>
      </div>
      {user.wallet && (
        <span className="font-mono text-[11px] text-neutral-400">Wallet: {user.wallet}</span>
      )}
    </div>
  );
}

export function BannerRolRequerido({
  rolRequerido,
  titulo,
  descripcion,
  userActual,
  redirectTo,
}: {
  rolRequerido: RolUsuario;
  titulo?: string;
  descripcion?: string;
  userActual?: PerfilUsuario | null;
  redirectTo?: string;
}) {
  const nombreRol =
    rolRequerido === 'PRODUCTOR'
      ? 'Productor'
      : rolRequerido === 'VETERINARIO'
        ? 'Veterinario'
        : 'Comprador';

  const loginHref = redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login';
  const registerHref = redirectTo
    ? `/login?tab=register&redirectTo=${encodeURIComponent(redirectTo)}`
    : '/login?tab=register';

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/90 p-5 text-sm text-neutral-300 shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="font-bold text-white">{titulo ?? `Se requiere cuenta de ${nombreRol}`}</h3>
          <p className="text-xs text-neutral-400">
            {descripcion ??
              `Para ejecutar esta etapa del flujo necesitás iniciar sesión con un perfil de ${nombreRol}.`}
          </p>
          {userActual && (
            <p className="text-xs text-yellow-400">
              Actualmente tenés sesión iniciada como <strong>{userActual.nombre_completo}</strong> (
              {userActual.rol}).
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Link
            href={loginHref}
            className="inline-flex items-center justify-center rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold text-black transition-all hover:bg-yellow-300"
          >
            {userActual
              ? `Cambiar a cuenta de ${nombreRol} →`
              : `Iniciar sesión como ${nombreRol} →`}
          </Link>
          <Link
            href={registerHref}
            className="text-center text-xs text-neutral-400 underline transition-colors hover:text-yellow-400"
          >
            ¿No tenés cuenta? Registrarse aquí
          </Link>
        </div>
      </div>
    </div>
  );
}
