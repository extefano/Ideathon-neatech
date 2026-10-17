import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Aviso } from '@/components/ui/aviso';
import { loginDemoAction } from '@/lib/auth-actions';
import type { PerfilUsuario, RolUsuario } from '@/lib/auth';
import { esWalletStellar } from '@/lib/stellar-args';

const NOMBRE_ROL: Record<RolUsuario, string> = {
  PRODUCTOR: 'Productor',
  VETERINARIO: 'Veterinario acreditado',
  COMPRADOR: 'Comprador',
  FRIGORIFICO: 'Frigorífico',
};

export function CredencialSesion({ user }: { user: PerfilUsuario }) {
  const walletValida = user.wallet && esWalletStellar(user.wallet) ? user.wallet : null;
  return (
    <div className="rounded-control border-borde bg-panel-elevado text-texto-suave flex flex-wrap items-center justify-between gap-2 border px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span>
          Operando como: <strong className="text-texto">{user.nombre_completo}</strong> · CUIT{' '}
          <span className="text-texto font-mono">{user.cuit}</span> ·{' '}
          <span className="text-brand-fuerte font-semibold">{NOMBRE_ROL[user.rol]}</span>
        </span>
      </div>
      {walletValida && (
        <span className="text-texto-suave font-mono text-[11px]">
          Wallet: {walletValida.slice(0, 4)}…{walletValida.slice(-4)}
        </span>
      )}
    </div>
  );
}

export function BannerRolRequerido({
  rolRequerido,
  rolesPermitidos,
  titulo,
  descripcion,
  userActual,
  redirectTo,
}: {
  rolRequerido: RolUsuario;
  rolesPermitidos?: RolUsuario[];
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
        <p className="text-texto-suave mt-1">
          Estás con sesión iniciada como <strong>{userActual.nombre_completo}</strong> (
          {NOMBRE_ROL[userActual.rol]}).
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {rolesPermitidos && rolesPermitidos.length > 0 ? (
          rolesPermitidos.map((rol) => (
            <form key={rol} action={loginDemoAction}>
              <input type="hidden" name="rol" value={rol} />
              <input type="hidden" name="redirectTo" value={redirectTo ?? '/'} />
              <button
                type="submit"
                className="rounded-control focus-visible:ring-foco bg-brand hover:bg-brand/90 inline-flex min-h-11 cursor-pointer items-center justify-center px-4 py-2 text-xs font-bold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
              >
                {userActual
                  ? `Cambiar a cuenta demo de ${NOMBRE_ROL[rol]} →`
                  : `Ingresar como demo ${NOMBRE_ROL[rol]} →`}
              </button>
            </form>
          ))
        ) : userActual ? (
          <Link
            href={loginHref}
            className="rounded-control focus-visible:ring-foco bg-brand inline-flex min-h-11 items-center justify-center px-4 py-2 text-xs font-bold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Cambiar a cuenta de {nombreRol}
            <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" />
          </Link>
        ) : (
          <Link
            href={loginHref}
            className="rounded-control focus-visible:ring-foco bg-brand inline-flex min-h-11 items-center justify-center px-4 py-2 text-xs font-bold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Iniciar sesión como {nombreRol}
            <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" />
          </Link>
        )}
        <Link
          href={registerHref}
          className="focus-visible:ring-foco text-texto-suave text-xs underline focus-visible:ring-2 focus-visible:outline-none"
        >
          ¿No tenés cuenta? Registrate
        </Link>
      </div>
    </Aviso>
  );
}
