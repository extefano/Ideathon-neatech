'use client';

import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
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

function IconoGoogle() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-4 w-4 shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function IconoApple() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
      <path
        fill="currentColor"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </svg>
  );
}

function IconoFacebook() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}

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
        <Image
          src="/brand/muunar-logo-negro.svg"
          alt="Muunar"
          width={565}
          height={673}
          className="mx-auto block h-20 w-auto"
        />
        <h1 className="text-texto mt-1 text-2xl font-bold tracking-tight">
          {tab === 'login' ? 'Iniciar sesión' : 'Creá tu cuenta'}
        </h1>
        <p className="text-texto-suave mt-1 text-xs">
          {tab === 'login'
            ? 'Accedé a tu perfil de trazabilidad ganadera EUDR'
            : 'Elegí tu rol en la cadena y completá tus datos'}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Ingresar o registrarse"
        className="rounded-control border-borde bg-panel-elevado mt-6 grid grid-cols-2 border p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'login'}
          onClick={() => cambiarTab('login')}
          className={`rounded-control focus-visible:ring-foco cursor-pointer py-2 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:outline-none ${
            tab === 'login'
              ? 'bg-brand text-neutral-950 shadow'
              : 'text-texto-suave hover:text-texto'
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
              : 'text-texto-suave hover:text-texto'
          }`}
        >
          Registrar
        </button>
      </div>

      {/* Ingreso con redes sociales (próximamente) */}
      <div className="mt-6 space-y-4">
        <div
          className="grid grid-cols-3 gap-2"
          role="group"
          aria-label="Ingreso con redes sociales"
        >
          <Boton
            variante="secundario"
            disabled
            title="Próximamente"
            aria-label="Continuar con Google (próximamente)"
            className="w-full"
          >
            <IconoGoogle />
          </Boton>
          <Boton
            variante="secundario"
            disabled
            title="Próximamente"
            aria-label="Continuar con Apple (próximamente)"
            className="w-full"
          >
            <IconoApple />
          </Boton>
          <Boton
            variante="secundario"
            disabled
            title="Próximamente"
            aria-label="Continuar con Facebook (próximamente)"
            className="w-full"
          >
            <IconoFacebook />
          </Boton>
        </div>
        <p className="text-texto-tenue text-center text-[11px]">
          Ingreso con redes sociales: próximamente.
        </p>

        <div className="flex items-center gap-3">
          <span className="bg-borde h-px flex-1" aria-hidden="true" />
          <span className="text-texto-tenue text-[11px] font-medium tracking-wider uppercase">
            o con tu correo
          </span>
          <span className="bg-borde h-px flex-1" aria-hidden="true" />
        </div>
      </div>

      {/* Formulario: Iniciar sesión */}
      {tab === 'login' && (
        <form action={runLoginAction} onSubmit={alEnviarLogin} className="space-y-4" noValidate>
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
            {loginPending ? (
              'Iniciando sesión…'
            ) : (
              <>
                Iniciar sesión
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </>
            )}
          </Boton>
        </form>
      )}

      {tab === 'register' && (
        <form
          action={runRegisterAction}
          onSubmit={alEnviarRegistro}
          className="space-y-5"
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
            <legend className="text-texto-suave text-xs font-semibold tracking-wide uppercase">
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
                        ? 'border-brand-fuerte ring-brand-fuerte bg-panel ring-1'
                        : 'border-borde bg-panel hover:border-borde-fuerte'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold ${activo ? 'text-brand-fuerte' : 'text-texto'}`}
                    >
                      {item.titulo}
                    </span>
                    <span className="text-texto-tenue text-[11px] leading-tight">
                      {item.descripcion}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-texto-suave text-xs font-semibold tracking-wide uppercase">
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
                    className="text-texto-suave block text-xs font-semibold tracking-wide uppercase"
                  >
                    Tipo de comprador
                  </label>
                  <select
                    id="campo-tipo_comprador"
                    name="tipo_comprador"
                    className="rounded-control focus-visible:ring-foco border-borde-fuerte bg-panel text-texto min-h-11 w-full border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
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
            {registerPending ? (
              'Registrando…'
            ) : (
              <>
                Registrar como {ROLES.find((r) => r.id === rol)?.titulo}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </>
            )}
          </Boton>
        </form>
      )}

      <div className="border-borde mt-8 border-t pt-5">
        <p className="text-texto-suave text-center text-[11px] font-medium">
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
                className="rounded-control focus-visible:ring-foco hover:border-brand-fuerte border-borde bg-panel w-full cursor-pointer border p-2 text-center text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="text-texto block font-semibold">{item.etiqueta}</span>
                <span className="text-texto-tenue block truncate text-[10px]">{item.demo}</span>
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
