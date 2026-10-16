'use client';

import { useActionState, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Aviso } from '@/components/ui/aviso';
import { Boton } from '@/components/ui/boton';
import { Campo } from '@/components/ui/campo';
import { loginAction, loginDemoAction, registerAction } from '@/lib/auth-actions';
import type { AuthFormState, RolUsuario } from '@/lib/auth';

const ROLES: { id: RolUsuario; titulo: string; descripcion: string }[] = [
  {
    id: 'PRODUCTOR',
    titulo: 'Productor',
    descripcion: 'Da de alta lotes y despacha el DT-e en origen.',
  },
  {
    id: 'VETERINARIO',
    titulo: 'Veterinario acreditado',
    descripcion: 'Firma la auditoría del Mes 4 (SENASA/SIGSA).',
  },
  {
    id: 'COMPRADOR',
    titulo: 'Comprador',
    descripcion: 'Fondea el escrow y confirma la recepción en balanza.',
  },
];

type ErroresCampo = Record<string, string>;

function validarLogin(form: FormData): ErroresCampo {
  const errores: ErroresCampo = {};
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email) errores.email = 'Ingresá tu correo electrónico.';
  else if (!email.includes('@')) errores.email = 'El correo no parece válido.';
  if (!password) errores.password = 'Ingresá tu contraseña.';
  return errores;
}

function validarRegistro(form: FormData, rol: RolUsuario): ErroresCampo {
  const errores: ErroresCampo = {};
  const nombre = String(form.get('nombre_completo') ?? '').trim();
  const cuit = String(form.get('cuit') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!nombre) errores.nombre_completo = 'Ingresá tu nombre o razón social.';
  if (!cuit) errores.cuit = 'Ingresá tu CUIT.';
  if (!email) errores.email = 'Ingresá tu correo electrónico.';
  else if (!email.includes('@')) errores.email = 'El correo no parece válido.';
  if (password.length < 6) errores.password = 'La contraseña debe tener al menos 6 caracteres.';
  if (rol === 'VETERINARIO' && !String(form.get('matricula_profesional') ?? '').trim()) {
    errores.matricula_profesional = 'La matrícula profesional es obligatoria.';
  }
  return errores;
}

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

  const [tab, setTab] = useState<'login' | 'register'>(activeTab);
  const [rol, setRol] = useState<RolUsuario>('PRODUCTOR');
  const [erroresLogin, setErroresLogin] = useState<ErroresCampo>({});
  const [erroresRegistro, setErroresRegistro] = useState<ErroresCampo>({});

  const [loginState, runLoginAction, loginPending] = useActionState<AuthFormState, FormData>(
    loginAction,
    { errors: [] },
  );
  const [registerState, runRegisterAction, registerPending] = useActionState<
    AuthFormState,
    FormData
  >(registerAction, { errors: [] });

  function cambiarTab(nuevoTab: 'login' | 'register') {
    const params = new URLSearchParams(searchParams.toString());
    if (nuevoTab === 'register') params.set('tab', 'register');
    else params.delete('tab');
    const qs = params.toString();
    window.history.replaceState(null, '', `/login${qs ? `?${qs}` : ''}`);
    setTab(nuevoTab);
  }

  function alEnviarLogin(event: FormEvent<HTMLFormElement>) {
    const errores = validarLogin(new FormData(event.currentTarget));
    setErroresLogin(errores);
    if (Object.keys(errores).length > 0) event.preventDefault();
  }

  function alEnviarRegistro(event: FormEvent<HTMLFormElement>) {
    const errores = validarRegistro(new FormData(event.currentTarget), rol);
    setErroresRegistro(errores);
    if (Object.keys(errores).length > 0) event.preventDefault();
  }

  return (
    <div className="rounded-tarjeta border-borde bg-panel w-full max-w-md border p-6 shadow-2xl sm:p-8">
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

      <div
        role="tablist"
        aria-label="Ingresar o registrarse"
        className="rounded-control mt-6 grid grid-cols-2 border border-neutral-800 bg-neutral-900/60 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'login'}
          onClick={() => cambiarTab('login')}
          className={`rounded-control focus-visible:ring-foco cursor-pointer py-2 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:outline-none ${
            tab === 'login'
              ? 'bg-brand text-neutral-950 shadow'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'register'}
          onClick={() => cambiarTab('register')}
          className={`rounded-control focus-visible:ring-foco cursor-pointer py-2 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:outline-none ${
            tab === 'register'
              ? 'bg-brand text-neutral-950 shadow'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Registrar
        </button>
      </div>

      {tab === 'login' && (
        <form
          action={runLoginAction}
          onSubmit={alEnviarLogin}
          className="mt-6 space-y-4"
          noValidate
        >
          <input type="hidden" name="redirectTo" value={redirectTarget} />

          {loginState.errors.length > 0 && (
            <Aviso variante="error" titulo="No pudimos iniciar sesión">
              <ul className="list-disc space-y-1 pl-4">
                {loginState.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </Aviso>
          )}

          <Campo
            etiqueta="Correo electrónico"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@empresa.com"
            error={erroresLogin.email}
          />
          <Campo
            etiqueta="Contraseña"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••••••"
            error={erroresLogin.password}
          />

          <Boton type="submit" cargando={loginPending} className="w-full">
            {loginPending ? 'Iniciando sesión…' : 'Iniciar sesión →'}
          </Boton>
        </form>
      )}

      {tab === 'register' && (
        <form
          action={runRegisterAction}
          onSubmit={alEnviarRegistro}
          className="mt-6 space-y-5"
          noValidate
        >
          <input type="hidden" name="rol" value={rol} />
          <input type="hidden" name="redirectTo" value={redirectTarget} />

          {registerState.errors.length > 0 && (
            <Aviso variante="error" titulo="No pudimos crear tu cuenta">
              <ul className="list-disc space-y-1 pl-4">
                {registerState.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </Aviso>
          )}

          <fieldset>
            <legend className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">
              1. Elegí tu perfil en la cadena
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {ROLES.map((item) => {
                const activo = rol === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setRol(item.id)}
                    className={`rounded-tarjeta focus-visible:ring-foco flex cursor-pointer flex-col items-start gap-1 border p-3 text-left transition-all focus-visible:ring-2 focus-visible:outline-none ${
                      activo
                        ? 'border-brand ring-brand bg-neutral-900 ring-1'
                        : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold ${activo ? 'text-brand' : 'text-neutral-200'}`}
                    >
                      {item.titulo}
                    </span>
                    <span className="text-[11px] leading-tight text-neutral-500">
                      {item.descripcion}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">
              2. Tus datos profesionales
            </legend>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                etiqueta={
                  rol === 'PRODUCTOR'
                    ? 'Nombre o razón social'
                    : rol === 'VETERINARIO'
                      ? 'Nombre completo'
                      : 'Razón social'
                }
                name="nombre_completo"
                required
                error={erroresRegistro.nombre_completo}
              />
              <Campo etiqueta="CUIT" name="cuit" required error={erroresRegistro.cuit} />
            </div>

            {rol === 'PRODUCTOR' && (
              <Campo
                etiqueta="Operador consignatario (opcional)"
                name="operador_consignatario"
                placeholder="Consignataria del Sur SA"
              />
            )}

            {rol === 'VETERINARIO' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo
                  etiqueta="Matrícula profesional"
                  name="matricula_profesional"
                  required
                  error={erroresRegistro.matricula_profesional}
                />
                <Campo etiqueta="Acreditación SENASA" name="acreditacion_senasa" />
              </div>
            )}

            {rol === 'COMPRADOR' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="campo-tipo_comprador"
                    className="block text-xs font-semibold tracking-wide text-neutral-400 uppercase"
                  >
                    Tipo de comprador
                  </label>
                  <select
                    id="campo-tipo_comprador"
                    name="tipo_comprador"
                    className="rounded-control focus-visible:ring-foco min-h-11 w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <option value="FRIGORIFICO_EXPORTADOR">Frigorífico exportador</option>
                    <option value="INVERSOR_AGRO">Inversor agropecuario</option>
                    <option value="CONSIGNATARIA">Consignataria</option>
                  </select>
                </div>
                <Campo etiqueta="Matrícula RUCA (opcional)" name="matricula_ruca" />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                etiqueta="Correo electrónico"
                name="email"
                type="email"
                required
                autoComplete="email"
                error={erroresRegistro.email}
              />
              <Campo
                etiqueta="Contraseña"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                ayuda="Mínimo 6 caracteres."
                error={erroresRegistro.password}
              />
            </div>
          </fieldset>

          <Boton type="submit" cargando={registerPending} className="w-full">
            {registerPending
              ? 'Registrando…'
              : `Registrar como ${ROLES.find((r) => r.id === rol)?.titulo} →`}
          </Boton>
        </form>
      )}

      <div className="mt-8 border-t border-neutral-800 pt-5">
        <p className="text-center text-[11px] font-medium text-neutral-400">
          O ingresá rápidamente con un rol demo para evaluar el flujo:
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              { rol: 'PRODUCTOR', etiqueta: 'Productor', demo: 'Cabaña Las Lilas' },
              { rol: 'VETERINARIO', etiqueta: 'Veterinario', demo: 'Dr. Saavedra' },
              { rol: 'COMPRADOR', etiqueta: 'Comprador', demo: 'Rioplatense SA' },
            ] as const
          ).map((item) => (
            <form key={item.rol} action={loginDemoAction}>
              <input type="hidden" name="rol" value={item.rol} />
              <input type="hidden" name="redirectTo" value={redirectTarget} />
              <button
                type="submit"
                className="rounded-control focus-visible:ring-foco hover:border-brand w-full cursor-pointer border border-neutral-800 bg-neutral-900/80 p-2 text-center text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="block font-semibold text-neutral-200">{item.etiqueta}</span>
                <span className="block truncate text-[10px] text-neutral-500">{item.demo}</span>
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
