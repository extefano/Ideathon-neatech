'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';
import { ensureDemoUser, type AuthFormState, type RolUsuario } from './auth';

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = (formData.get('email') as string | null)?.trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const redirectTo = (formData.get('redirectTo') as string | null) ?? '/';

  if (!email || !password) {
    return { errors: ['Completá tu correo electrónico y contraseña.'] };
  }

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
  redirect(redirectTo.startsWith('/') ? redirectTo : '/');
}

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const rol = (formData.get('rol') as RolUsuario | null) ?? 'PRODUCTOR';
  const nombreCompleto = (formData.get('nombre_completo') as string | null)?.trim() ?? '';
  const cuit = (formData.get('cuit') as string | null)?.trim() ?? '';
  const email = (formData.get('email') as string | null)?.trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const redirectTo = (formData.get('redirectTo') as string | null) ?? '/';

  const errors: string[] = [];

  if (!['PRODUCTOR', 'VETERINARIO', 'COMPRADOR'].includes(rol)) {
    errors.push('El rol seleccionado no es válido.');
  }
  if (!nombreCompleto) {
    errors.push('El nombre o razón social es obligatorio.');
  }
  if (!cuit) {
    errors.push('El CUIT es obligatorio.');
  }
  if (!email || !email.includes('@')) {
    errors.push('Ingresá un correo electrónico válido.');
  }
  if (!password || password.length < 6) {
    errors.push('La contraseña debe tener al menos 6 caracteres.');
  }

  let matriculaProfesional = '';
  let acreditacionSenasa = '';
  let operadorConsignatario = '';
  let tipoComprador: 'FRIGORIFICO_EXPORTADOR' | 'INVERSOR_AGRO' | 'CONSIGNATARIA' =
    'FRIGORIFICO_EXPORTADOR';
  let matriculaRuca = '';

  if (rol === 'VETERINARIO') {
    matriculaProfesional = (formData.get('matricula_profesional') as string | null)?.trim() ?? '';
    acreditacionSenasa = (formData.get('acreditacion_senasa') as string | null)?.trim() ?? '';
    if (!matriculaProfesional) {
      errors.push('La matrícula profesional es obligatoria para veterinarios.');
    }
  } else if (rol === 'PRODUCTOR') {
    operadorConsignatario = (formData.get('operador_consignatario') as string | null)?.trim() ?? '';
  } else if (rol === 'COMPRADOR') {
    const rawTipo = (formData.get('tipo_comprador') as string | null) ?? 'FRIGORIFICO_EXPORTADOR';
    if (['FRIGORIFICO_EXPORTADOR', 'INVERSOR_AGRO', 'CONSIGNATARIA'].includes(rawTipo)) {
      tipoComprador = rawTipo as typeof tipoComprador;
    }
    matriculaRuca = (formData.get('matricula_ruca') as string | null)?.trim() ?? '';
  }

  if (errors.length > 0) {
    return { errors };
  }

  const admin = createAdminClient();

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { rol, nombre_completo: nombreCompleto },
  });

  if (userError || !userData.user) {
    if (userError?.message?.includes('already registered')) {
      return { errors: ['Ese correo electrónico ya tiene una cuenta registrada.'] };
    }
    return { errors: [userError?.message ?? 'No se pudo crear la cuenta.'] };
  }

  const userId = userData.user.id;
  const shortId = userId.replace(/-/g, '').slice(0, 10).toUpperCase();

  let productorId: string | null = null;
  let veterinarioId: string | null = null;
  let compradorId: string | null = null;
  const wallet = `G${rol.slice(0, 4)}-${shortId}`;

  if (rol === 'PRODUCTOR') {
    const { data: prod, error: prodErr } = await admin
      .from('productores')
      .insert({
        wallet,
        nombre_razon_social: nombreCompleto,
        cuit,
        operador_consignatario: operadorConsignatario || null,
      })
      .select('id')
      .single();

    if (prodErr) {
      return { errors: [`Error registrando productor: ${prodErr.message}`] };
    }
    productorId = prod.id;
  } else if (rol === 'VETERINARIO') {
    const { data: vet, error: vetErr } = await admin
      .from('veterinarios')
      .insert({
        wallet,
        nombre_completo: nombreCompleto,
        cuit,
        matricula_profesional: matriculaProfesional,
        acreditacion_senasa: acreditacionSenasa || null,
      })
      .select('id')
      .single();

    if (vetErr) {
      return { errors: [`Error registrando veterinario: ${vetErr.message}`] };
    }
    veterinarioId = vet.id;
  } else if (rol === 'COMPRADOR') {
    const { data: comp, error: compErr } = await admin
      .from('compradores')
      .insert({
        wallet,
        razon_social: nombreCompleto,
        cuit,
        tipo_comprador: tipoComprador,
        matricula_ruca: matriculaRuca || null,
      })
      .select('id')
      .single();

    if (compErr) {
      return { errors: [`Error registrando comprador: ${compErr.message}`] };
    }
    compradorId = comp.id;
  }

  const { error: perfilErr } = await admin.from('perfiles').insert({
    id: userId,
    rol,
    nombre_completo: nombreCompleto,
    cuit,
    matricula: matriculaProfesional || null,
    tipo_comprador: rol === 'COMPRADOR' ? tipoComprador : null,
    wallet,
    productor_id: productorId,
    veterinario_id: veterinarioId,
    comprador_id: compradorId,
  });

  if (perfilErr) {
    return { errors: [`Error guardando perfil: ${perfilErr.message}`] };
  }

  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInErr) {
    return { errors: ['Cuenta creada, pero ocurrió un error al iniciar sesión automática.'] };
  }

  revalidatePath('/', 'layout');
  redirect(redirectTo.startsWith('/') ? redirectTo : '/');
}

export async function loginDemoAction(input: FormData | RolUsuario): Promise<void> {
  let rol: RolUsuario = 'PRODUCTOR';
  let redirectTo = '/';
  if (typeof input === 'string') {
    rol = input;
  } else if (input instanceof FormData) {
    rol = (input.get('rol') as RolUsuario) || 'PRODUCTOR';
    const formRedirect = input.get('redirectTo') as string | null;
    if (formRedirect && formRedirect.startsWith('/')) {
      redirectTo = formRedirect;
    }
  }

  const creds = await ensureDemoUser(rol);
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword(creds);

  if (error) {
    throw new Error(`Error iniciando sesión demo: ${error.message}`);
  }

  revalidatePath('/', 'layout');
  redirect(redirectTo.startsWith('/') ? redirectTo : '/');
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.includes('sb-') || cookie.name.includes('auth')) {
      cookieStore.set(cookie.name, '', { path: '/', maxAge: 0 });
      cookieStore.delete(cookie.name);
    }
  }
  revalidatePath('/', 'layout');
  redirect('/login');
}
