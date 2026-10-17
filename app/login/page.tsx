import { Suspense } from 'react';
import Link from 'next/link';
import { Aviso } from '@/components/ui/aviso';
import { getCurrentUser, logoutAction, rutaInternaSegura } from '@/lib/auth';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; msg?: string; redirectTo?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const defaultTab = sp.tab === 'register' ? 'register' : 'login';
  const redirectTo = rutaInternaSegura(sp.redirectTo);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center p-4 sm:p-6">
      {user && (
        <div className="mb-6 w-full max-w-md">
          <Aviso variante="info" titulo={`Sesión activa como ${user.nombre_completo}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Rol: <strong>{user.rol}</strong>
              </span>
              <Link
                href="/"
                className="focus-visible:ring-foco font-bold underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Ir al inicio
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="focus-visible:ring-foco cursor-pointer underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          </Aviso>
        </div>
      )}

      {sp.error && (
        <div className="mb-6 w-full max-w-md">
          <Aviso variante="error" titulo="No pudimos completar la operación">
            {sp.error}
          </Aviso>
        </div>
      )}

      {sp.msg && (
        <div className="mb-6 w-full max-w-md">
          <Aviso variante="info">{sp.msg}</Aviso>
        </div>
      )}

      <Suspense
        fallback={
          <div className="rounded-tarjeta border-borde bg-panel h-96 w-full max-w-md border p-8 text-center text-xs text-neutral-500">
            Cargando…
          </div>
        }
      >
        <LoginForm
          key={`${defaultTab}-${redirectTo}`}
          defaultTab={defaultTab}
          redirectTo={redirectTo}
        />
      </Suspense>
    </main>
  );
}
