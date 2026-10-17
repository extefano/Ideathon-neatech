'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';
import {
  ensureDemoUser,
  rutaInternaSegura,
  validarDatosRegistro,
  type AuthFormState,
  type DatosRegistroEntrada,
  type DatosRegistroValidados,
  type RolUsuario,
} from './auth';

function leerEntradaRegistro(formData: FormData): DatosRegistroEntrada {
  return {
    rol: formData.get('rol') as string | null,
    nombre_completo: formData.get('nombre_completo') as string | null,
    cuit: formData.get('cuit') as string | null,
    email: formData.get('email') as string | null,
    password: formData.get('password') as string | null,
    matricula_profesional: formData.get('matricula_profesional') as string | null,
    acreditacion_senasa: formData.get('acreditacion_senasa') as string | null,
    operador_consignatario: formData.get('operador_consignatario') as string | null,
    tipo_comprador: formData.get('tipo_comprador') as string | null,
    matricula_ruca: formData.get('matricula_ruca') as string | null,
  };
}

async function crearActorYPerfil(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  datos: DatosRegistroValidados,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const shortId = userId.replace(/-/g, '').slice(0, 10).toUpperCase();
  const wallet = `G${datos.rol.slice(0, 4)}-${shortId}`;

  let productorId: string | null = null;
  let veterinarioId: string | null = null;
  let compradorId: string | null = null;

  if (datos.rol === 'PRODUCTOR') {
    const { data, error } = await admin
      .from('productores')
      .upsert(
        {
          wallet,
          nombre_razon_social: datos.nombreCompleto,
          cuit: datos.cuit,
          operador_consignatario: datos.operadorConsignatario || null,
        },
        { onConflict: 'wallet' },
      )
      .select('id')
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: `Error registrando productor: ${error?.message ?? 'error desconocido'}`,
      };
    }
    productorId = data.id;
  } else if (datos.rol === 'VETERINARIO') {
    const { data, error } = await admin
      .from('veterinarios')
      .upsert(
        {
          wallet,
          nombre_completo: datos.nombreCompleto,
          cuit: datos.cuit,
          matricula_profesional: datos.matriculaProfesional,
          acreditacion_senasa: datos.acreditacionSenasa || null,
        },
        { onConflict: 'wallet' },
      )
      .select('id')
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: `Error registrando veterinario: ${error?.message ?? 'error desconocido'}`,
      };
    }
    veterinarioId = data.id;
  } else {
    const { data, error } = await admin
      .from('compradores')
      .upsert(
        {
          wallet,
          razon_social: datos.nombreCompleto,
          cuit: datos.cuit,
          tipo_comprador: datos.tipoComprador,
          matricula_ruca: datos.matriculaRuca || null,
        },
        { onConflict: 'wallet' },
      )
      .select('id')
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: `Error registrando comprador: ${error?.message ?? 'error desconocido'}`,
      };
    }
    compradorId = data.id;
  }

  const { error: perfilError } = await admin.from('perfiles').upsert(
    {
      id: userId,
      rol: datos.rol,
      nombre_completo: datos.nombreCompleto,
      cuit: datos.cuit,
      matricula: datos.matriculaProfesional || null,
      tipo_comprador: datos.rol === 'COMPRADOR' ? datos.tipoComprador : null,
      wallet,
      productor_id: productorId,
      veterinario_id: veterinarioId,
      comprador_id: compradorId,
    },
    { onConflict: 'id' },
  );

  if (perfilError) {
    return { ok: false, error: `Error guardando perfil: ${perfilError.message}` };
  }

  return { ok: true };
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = (formData.get('email') as string | null)?.trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const redirectTo = rutaInternaSegura(formData.get('redirectTo') as string | null);

  if (!email || !password) {
    return { errors: ['Completá tu correo electrónico y contraseña.'] };
  }

  const cookieStore = await cookies();

  // Si se ingresan credenciales del frigorífico demo
  const demoFrigo = (await import('./auth')).DEMO_USERS.FRIGORIFICO;
  if (email.toLowerCase() === demoFrigo.email.toLowerCase() && password === demoFrigo.password) {
    cookieStore.set('muunar_demo_rol', 'FRIGORIFICO', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // noop
    }
    revalidatePath('/', 'layout');
    redirect(redirectTo);
  }

  cookieStore.delete('muunar_demo_rol');

  // Si se ingresa un correo de cuenta demo, garantizar que esté inicializada
  const roles: RolUsuario[] = ['PRODUCTOR', 'VETERINARIO', 'COMPRADOR'];
  for (const r of roles) {
    const d = (await import('./auth')).DEMO_USERS[r];
    const legacy = d.email.replace('@muunar.agro', '@neatech.agro');
    if (
      email.toLowerCase() === d.email.toLowerCase() ||
      email.toLowerCase() === legacy.toLowerCase()
    ) {
      await ensureDemoUser(r);
      break;
    }
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { errors: ['Credenciales inválidas. Verificá tu correo y contraseña.'] };
  }

  revalidatePath('/', 'layout');
  redirect(redirectTo);
}

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const cookieStore = await cookies();
  cookieStore.delete('muunar_demo_rol');
  const redirectTo = rutaInternaSegura(formData.get('redirectTo') as string | null);
  const validacion = validarDatosRegistro(leerEntradaRegistro(formData), {
    requiereCredenciales: true,
  });

  if (!validacion.ok) {
    return { errors: validacion.errors };
  }
  const datos = validacion.datos;

  const admin = createAdminClient();

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: datos.email,
    password: datos.password,
    email_confirm: true,
    user_metadata: { rol: datos.rol, nombre_completo: datos.nombreCompleto },
  });

  if (userError || !userData.user) {
    if (userError?.message?.includes('already registered')) {
      return { errors: ['Ese correo electrónico ya tiene una cuenta registrada.'] };
    }
    return { errors: [userError?.message ?? 'No se pudo crear la cuenta.'] };
  }

  const creado = await crearActorYPerfil(admin, userData.user.id, datos);
  if (!creado.ok) {
    return { errors: [creado.error] };
  }

  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: datos.email,
    password: datos.password,
  });

  if (signInErr) {
    return { errors: ['Cuenta creada, pero ocurrió un error al iniciar sesión automática.'] };
  }

  revalidatePath('/', 'layout');
  redirect(redirectTo);
}

export async function loginDemoAction(input: FormData | RolUsuario): Promise<void> {
  let rol: RolUsuario = 'PRODUCTOR';
  let redirectTo = '/';
  if (typeof input === 'string') {
    rol = input;
  } else if (input instanceof FormData) {
    rol = (input.get('rol') as RolUsuario) || 'PRODUCTOR';
    redirectTo = rutaInternaSegura(input.get('redirectTo') as string | null);
  }

  const cookieStore = await cookies();

  if (rol === 'FRIGORIFICO') {
    cookieStore.set('muunar_demo_rol', 'FRIGORIFICO', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // noop
    }
    revalidatePath('/', 'layout');
    redirect(redirectTo);
  }

  cookieStore.delete('muunar_demo_rol');
  const creds = await ensureDemoUser(rol);
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword(creds);

  if (error) {
    throw new Error(`Error iniciando sesión demo: ${error.message}`);
  }

  revalidatePath('/', 'layout');
  redirect(redirectTo);
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('muunar_demo_rol');
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // noop
  }
  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name.includes('sb-') ||
      cookie.name.includes('auth') ||
      cookie.name === 'muunar_demo_rol'
    ) {
      cookieStore.set(cookie.name, '', { path: '/', maxAge: 0 });
      cookieStore.delete(cookie.name);
    }
  }
  revalidatePath('/', 'layout');
  redirect('/login');
}
