import Link from 'next/link';
import { Aviso } from '@/components/ui/aviso';
import type { PerfilUsuario, RolUsuario } from '@/lib/auth';
import { esWalletStellar } from '@/lib/stellar-args';

const NOMBRE_ROL: Record<RolUsuario, string> = {
  PRODUCTOR: 'Productor',
  VETERINARIO: 'Veterinario acreditado',
  COMPRADOR: 'Comprador',
};

export function CredencialSesion({ user }: { user: PerfilUsuario }) {
  const walletValida = user.wallet && esWalletStellar(user.wallet) ? user.wallet : null;
  return (
    <div className="rounded-control flex flex-wrap items-center justify-between gap-2 border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300">
      <div className="flex items-center gap-2">
        <span>
          Operando como: <strong className="text-white">{user.nombre_completo}</strong> · CUIT{' '}
          <span className="font-mono text-neutral-200">{user.cuit}</span> ·{' '}
          <span className="text-brand font-semibold">{NOMBRE_ROL[user.rol]}</span>
        </span>
      </div>
      {walletValida && (
        <span className="font-mono text-[11px] text-neutral-400">
          Wallet: {walletValida.slice(0, 4)}…{walletValida.slice(-4)}
        </span>
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
  const nombreRol = NOMBRE_ROL[rolRequerido];

  const loginHref = redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login';
  const registerHref = redirectTo
    ? `/login?tab=register&redirectTo=${encodeURIComponent(redirectTo)}`
    : '/login?tab=register';

  return (
    <Aviso variante="alerta" titulo={titulo ?? `Esta acción requiere cuenta de ${nombreRol}`}>
      <p>
        {descripcion ??
          `Para ejecutar esta etapa del flujo tenés que iniciar sesión con un perfil de ${nombreRol}.`}
      </p>
      {userActual && (
        <p className="mt-1 text-neutral-300">
          Estás con sesión iniciada como <strong>{userActual.nombre_completo}</strong> (
          {NOMBRE_ROL[userActual.rol]}).
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {userActual ? (
          <Link
            href={loginHref}
            className="rounded-control focus-visible:ring-foco bg-brand inline-flex min-h-11 items-center justify-center px-4 py-2 text-xs font-bold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Cambiar a cuenta de {nombreRol} →
          </Link>
        ) : (
          <Link
            href={loginHref}
            className="rounded-control focus-visible:ring-foco bg-brand inline-flex min-h-11 items-center justify-center px-4 py-2 text-xs font-bold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Iniciar sesión como {nombreRol} →
          </Link>
        )}
        <Link
          href={registerHref}
          className="focus-visible:ring-foco text-xs text-neutral-300 underline focus-visible:ring-2 focus-visible:outline-none"
        >
          ¿No tenés cuenta? Registrate
        </Link>
      </div>
    </Aviso>
  );
}
