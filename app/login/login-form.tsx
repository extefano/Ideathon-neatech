'use client';

import { useActionState, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loginAction, loginDemoAction, registerAction } from '@/lib/auth-actions';
import type { AuthFormState, RolUsuario } from '@/lib/auth';

const claseInput =
  'w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-yellow-400 focus:outline-none';
const claseLabel = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400';

const ROLES: {
  id: RolUsuario;
  titulo: string;
  subtitulo: string;
}[] = [
  {
    id: 'PRODUCTOR',
    titulo: 'Productor',
    subtitulo: 'Cría / Recría',
  },
  {
    id: 'VETERINARIO',
    titulo: 'Veterinario',
    subtitulo: 'Acred. SENASA',
  },
  {
    id: 'COMPRADOR',
    titulo: 'Comprador',
    subtitulo: 'Frigoríf. / Inversor',
  },
];

export function LoginForm({
  defaultTab = 'login',
  redirectTo = '/',
}: {
  defaultTab?: 'login' | 'register';
  redirectTo?: string;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: 'login' | 'register' =
    tabParam === 'register' ? 'register' : tabParam === 'login' ? 'login' : defaultTab;
  const redirectTarget = searchParams.get('redirectTo') || redirectTo || '/';

  const [tabOverride, setTabOverride] = useState<{
    query: string | null;
    tab: 'login' | 'register';
  }>({
    query: tabParam,
    tab: activeTab,
  });

  const tab = tabOverride.query === tabParam ? tabOverride.tab : activeTab;
  const [rol, setRol] = useState<RolUsuario>('PRODUCTOR');

  const handleTabChange = (newTab: 'login' | 'register') => {
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === 'register') {
      params.set('tab', 'register');
    } else {
      params.delete('tab');
    }
    const qs = params.toString();
    window.history.replaceState(null, '', `/login${qs ? `?${qs}` : ''}`);
    setTabOverride({ query: newTab === 'register' ? 'register' : null, tab: newTab });
  };

  const [loginState, runLoginAction, loginPending] = useActionState<AuthFormState, FormData>(
    loginAction,
    { errors: [] },
  );

  const [registerState, runRegisterAction, registerPending] = useActionState<
    AuthFormState,
    FormData
  >(registerAction, { errors: [] });

  const labelBoton =
    rol === 'PRODUCTOR'
      ? 'Registrar como Productor →'
      : rol === 'VETERINARIO'
        ? 'Registrar como Veterinario →'
        : 'Registrar como Comprador →';

  return (
    <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl sm:p-8">
      {/* Header */}
      <div className="text-center">
        <span className="text-xl font-black tracking-widest text-white">MUUNAR</span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
          {tab === 'login' ? 'Iniciar sesión' : 'Creá tu cuenta'}
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          {tab === 'login'
            ? 'Accedé a tu perfil de trazabilidad ganadera EUDR'
            : 'Elegí tu rol en la cadena y completá tus datos'}
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-6 grid grid-cols-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-1">
        <button
          type="button"
          onClick={() => handleTabChange('login')}
          className={`cursor-pointer rounded-md py-2 text-xs font-semibold transition-all ${
            tab === 'login'
              ? 'bg-yellow-400 text-black shadow'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('register')}
          className={`cursor-pointer rounded-md py-2 text-xs font-semibold transition-all ${
            tab === 'register'
              ? 'bg-yellow-400 text-black shadow'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Registrar
        </button>
      </div>

      {/* Formulario: Iniciar sesión */}
      {tab === 'login' && (
        <form action={runLoginAction} className="mt-6 space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTarget} />

          {loginState.errors.length > 0 && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              <ul className="list-disc space-y-1 pl-4">
                {loginState.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className={claseLabel} htmlFor="login_email">
              Correo electrónico
            </label>
            <input
              id="login_email"
              name="email"
              type="email"
              required
              placeholder="tu@empresa.com"
              className={claseInput}
              autoComplete="email"
            />
          </div>

          <div>
            <label className={claseLabel} htmlFor="login_password">
              Contraseña
            </label>
            <input
              id="login_password"
              name="password"
              type="password"
              required
              placeholder="••••••••••••"
              className={claseInput}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loginPending}
            className="w-full cursor-pointer rounded-md bg-yellow-400 py-2.5 text-sm font-bold text-black shadow-md transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            {loginPending ? 'Iniciando sesión...' : 'Iniciar sesión →'}
          </button>
        </form>
      )}

      {/* Formulario: Registrar */}
      {tab === 'register' && (
        <form action={runRegisterAction} className="mt-6 space-y-5">
          <input type="hidden" name="rol" value={rol} />
          <input type="hidden" name="redirectTo" value={redirectTarget} />

          {registerState.errors.length > 0 && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              <ul className="list-disc space-y-1 pl-4">
                {registerState.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 1. Selector de Rol */}
          <div>
            <label className={claseLabel}>1. Elegí tu perfil en la cadena</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ROLES.map((item) => {
                const activo = rol === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRol(item.id)}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                      activo
                        ? 'border-yellow-400 bg-neutral-900 shadow-[0_0_12px_rgba(253,218,36,0.15)] ring-1 ring-yellow-400'
                        : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700 hover:bg-neutral-900/60'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold ${
                        activo ? 'text-yellow-400' : 'text-neutral-200'
                      }`}
                    >
                      {item.titulo}
                    </span>
                    <span className="mt-0.5 text-[10px] text-neutral-500">{item.subtitulo}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Datos según rol */}
          <div className="space-y-4">
            <label className={claseLabel}>2. Tus datos profesionales</label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={claseLabel} htmlFor="reg_nombre">
                  {rol === 'PRODUCTOR'
                    ? 'Nombre o Razón Social *'
                    : rol === 'VETERINARIO'
                      ? 'Nombre completo *'
                      : 'Razón Social *'}
                </label>
                <input
                  id="reg_nombre"
                  name="nombre_completo"
                  required
                  placeholder={
                    rol === 'PRODUCTOR'
                      ? 'Cabaña La Tranquera'
                      : rol === 'VETERINARIO'
                        ? 'Dra. Valeria Gómez'
                        : 'Frigorífico Export SA'
                  }
                  className={claseInput}
                />
              </div>

              <div>
                <label className={claseLabel} htmlFor="reg_cuit">
                  CUIT *
                </label>
                <input
                  id="reg_cuit"
                  name="cuit"
                  required
                  placeholder={rol === 'VETERINARIO' ? '27-33445566-9' : '30-71234567-8'}
                  className={claseInput}
                />
              </div>
            </div>

            {/* Campos condicionales */}
            {rol === 'PRODUCTOR' && (
              <div>
                <label className={claseLabel} htmlFor="reg_operador">
                  Operador Consignatario (opcional)
                </label>
                <input
                  id="reg_operador"
                  name="operador_consignatario"
                  placeholder="Consignataria del Sur SA"
                  className={claseInput}
                />
              </div>
            )}

            {rol === 'VETERINARIO' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={claseLabel} htmlFor="reg_matricula">
                    Matrícula profesional *
                  </label>
                  <input
                    id="reg_matricula"
                    name="matricula_profesional"
                    required
                    placeholder="MP-4102 Corrientes"
                    className={claseInput}
                  />
                </div>
                <div>
                  <label className={claseLabel} htmlFor="reg_senasa">
                    Acreditación SENASA
                  </label>
                  <input
                    id="reg_senasa"
                    name="acreditacion_senasa"
                    placeholder="SENASA-0412"
                    className={claseInput}
                  />
                </div>
              </div>
            )}

            {rol === 'COMPRADOR' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={claseLabel} htmlFor="reg_tipo_comprador">
                    Tipo de comprador *
                  </label>
                  <select id="reg_tipo_comprador" name="tipo_comprador" className={claseInput}>
                    <option value="FRIGORIFICO_EXPORTADOR">Frigorífico Exportador</option>
                    <option value="INVERSOR_AGRO">Inversor Agropecuario</option>
                    <option value="CONSIGNATARIA">Consignataria</option>
                  </select>
                </div>
                <div>
                  <label className={claseLabel} htmlFor="reg_ruca">
                    Matrícula RUCA (opcional)
                  </label>
                  <input
                    id="reg_ruca"
                    name="matricula_ruca"
                    placeholder="RUCA-8921"
                    className={claseInput}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={claseLabel} htmlFor="reg_email">
                  Correo electrónico *
                </label>
                <input
                  id="reg_email"
                  name="email"
                  type="email"
                  required
                  placeholder="usuario@dominio.com"
                  className={claseInput}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className={claseLabel} htmlFor="reg_password">
                  Contraseña *
                </label>
                <input
                  id="reg_password"
                  name="password"
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  className={claseInput}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={registerPending}
            className="w-full cursor-pointer rounded-md bg-yellow-400 py-2.5 text-sm font-bold text-black shadow-md transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            {registerPending ? 'Registrando...' : labelBoton}
          </button>
        </form>
      )}

      {/* Acceso Demo Secundario */}
      <div className="mt-8 border-t border-neutral-800 pt-5">
        <p className="text-center text-[11px] font-medium text-neutral-400">
          O ingresá rápidamente con un rol demo para evaluar el flujo:
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <form action={loginDemoAction}>
            <input type="hidden" name="rol" value="PRODUCTOR" />
            <input type="hidden" name="redirectTo" value={redirectTarget} />
            <button
              type="submit"
              className="w-full cursor-pointer rounded-lg border border-neutral-800 bg-neutral-900/80 p-2 text-center text-xs transition-colors hover:border-yellow-400 hover:bg-neutral-900"
            >
              <div className="font-semibold text-neutral-200">Productor</div>
              <div className="truncate text-[10px] text-neutral-500">Cabaña Las Lilas</div>
            </button>
          </form>

          <form action={loginDemoAction}>
            <input type="hidden" name="rol" value="VETERINARIO" />
            <input type="hidden" name="redirectTo" value={redirectTarget} />
            <button
              type="submit"
              className="w-full cursor-pointer rounded-lg border border-neutral-800 bg-neutral-900/80 p-2 text-center text-xs transition-colors hover:border-yellow-400 hover:bg-neutral-900"
            >
              <div className="font-semibold text-neutral-200">Veterinario</div>
              <div className="truncate text-[10px] text-neutral-500">Dr. Saavedra</div>
            </button>
          </form>

          <form action={loginDemoAction}>
            <input type="hidden" name="rol" value="COMPRADOR" />
            <input type="hidden" name="redirectTo" value={redirectTarget} />
            <button
              type="submit"
              className="w-full cursor-pointer rounded-lg border border-neutral-800 bg-neutral-900/80 p-2 text-center text-xs transition-colors hover:border-yellow-400 hover:bg-neutral-900"
            >
              <div className="font-semibold text-neutral-200">Comprador</div>
              <div className="truncate text-[10px] text-neutral-500">Rioplatense SA</div>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
