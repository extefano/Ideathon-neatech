import Link from 'next/link';
import { getCurrentUser, logoutAction } from '@/lib/auth';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const defaultTab = sp.tab === 'register' ? 'register' : 'login';

  return (
    <main className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center p-4 sm:p-6">
      {user && (
        <div className="mb-6 flex w-full max-w-md items-center justify-between rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-4 text-xs text-yellow-300">
          <div>
            <span className="font-semibold">Sesión activa:</span> {user.nombre_completo} ({user.rol}
            )
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="font-bold underline hover:text-white">
              Ir al inicio
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="cursor-pointer text-neutral-400 underline hover:text-white"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      )}

      {sp.error && (
        <div className="mb-6 w-full max-w-md rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
          {sp.error}
        </div>
      )}

      {sp.msg && (
        <div className="mb-6 w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-xs text-neutral-300">
          {sp.msg}
        </div>
      )}

      <LoginForm defaultTab={defaultTab} />
    </main>
  );
}
