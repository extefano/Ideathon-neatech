import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/storage';

export type RolUsuario = 'PRODUCTOR' | 'VETERINARIO' | 'COMPRADOR' | 'FRIGORIFICO';

export type Stage =
  | 'PASO_1_CREAR_LOTE'
  | 'PASO_2_FONDEAR_ESCROW'
  | 'PASO_3_AUDITORIA_VET'
  | 'PASO_4A_DESPACHO'
  | 'PASO_4B_RECEPCION'
  | 'PASO_5_PASAPORTE'
  | 'MERCADO';

export type PerfilUsuario = {
  id: string;
  rol: RolUsuario;
  nombre_completo: string;
  cuit: string;
  matricula: string | null;
  tipo_comprador: string | null;
  wallet: string | null;
  productor_id: string | null;
  veterinario_id: string | null;
  comprador_id: string | null;
  email?: string | null;
};

export type AuthFormState = {
  errors: string[];
};

export const TIPOS_COMPRADOR = [
  'FRIGORIFICO_EXPORTADOR',
  'INVERSOR_AGRO',
  'CONSIGNATARIA',
] as const;

export type TipoComprador = (typeof TIPOS_COMPRADOR)[number];

export type DatosRegistroEntrada = {
  rol?: string | null;
  nombre_completo?: string | null;
  cuit?: string | null;
  email?: string | null;
  password?: string | null;
  matricula_profesional?: string | null;
  acreditacion_senasa?: string | null;
  operador_consignatario?: string | null;
  tipo_comprador?: string | null;
  matricula_ruca?: string | null;
};

export type DatosRegistroValidados = {
  rol: RolUsuario;
  nombreCompleto: string;
  cuit: string;
  email: string;
  password: string;
  matriculaProfesional: string;
  acreditacionSenasa: string;
  operadorConsignatario: string;
  tipoComprador: TipoComprador;
  matriculaRuca: string;
};

export const DEMO_USERS: Record<
  RolUsuario,
  {
    email: string;
    password: string;
    nombre_completo: string;
    cuit: string;
    rol: RolUsuario;
    wallet: string;
    matricula?: string;
    acreditacion_senasa?: string;
    tipo_comprador?: TipoComprador;
    matricula_ruca?: string;
    operador_consignatario?: string;
    anos_operando?: number;
  }
> = {
  PRODUCTOR: {
    email: 'demo.productor@muunar.agro',
    password: 'demo-productor-2026',
    nombre_completo: 'Cabaña Las Lilas SA',
    cuit: '30-50123456-9',
    rol: 'PRODUCTOR',
    wallet: 'GDEMO-PRODUCTOR',
    operador_consignatario: 'Consignataria del Sur SA',
    anos_operando: 12,
  },
  VETERINARIO: {
    email: 'demo.veterinario@muunar.agro',
    password: 'demo-veterinario-2026',
    nombre_completo: 'Dr. Carlos Saavedra',
    cuit: '20-28491823-4',
    rol: 'VETERINARIO',
    wallet: 'GDEMO-VETERINARIO',
    matricula: 'MP-4102 SENASA',
    acreditacion_senasa: 'SENASA-0412',
  },
  COMPRADOR: {
    email: 'demo.comprador@muunar.agro',
    password: 'demo-comprador-2026',
    nombre_completo: 'Frigorífico Rioplatense SA',
    cuit: '30-61234567-1',
    rol: 'COMPRADOR',
    wallet: 'GDEMO-FRIGORIFICO',
    tipo_comprador: 'FRIGORIFICO_EXPORTADOR',
    matricula_ruca: 'RUCA-8921',
  },
  FRIGORIFICO: {
    email: 'demo.frigorifico@muunar.agro',
    password: 'demo-frigorifico-2026',
    nombre_completo: 'Frigorífico Exportador del Litoral SA',
    cuit: '30-71987654-3',
    rol: 'FRIGORIFICO',
    wallet: 'GDEMO-FRIGORIFICO',
    tipo_comprador: 'FRIGORIFICO_EXPORTADOR',
    matricula_ruca: 'RUCA-7742',
  },
};

export function rutaInternaSegura(valor: string | null | undefined, alterno = '/'): string {
  if (!valor) return alterno;
  if (!valor.startsWith('/')) return alterno;
  if (valor.startsWith('//') || valor.startsWith('/\\')) return alterno;
  return valor;
}

export function validarDatosRegistro(
  entrada: DatosRegistroEntrada,
  opciones: { requiereCredenciales: boolean },
): { ok: true; datos: DatosRegistroValidados } | { ok: false; errors: string[] } {
  const rol = entrada.rol ?? '';
  const nombreCompleto = entrada.nombre_completo?.trim() ?? '';
  const cuit = entrada.cuit?.trim() ?? '';
  const email = entrada.email?.trim() ?? '';
  const password = entrada.password ?? '';

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
  if (opciones.requiereCredenciales) {
    if (!email || !email.includes('@')) {
      errors.push('Ingresá un correo electrónico válido.');
    }
    if (!password || password.length < 6) {
      errors.push('La contraseña debe tener al menos 6 caracteres.');
    }
  }

  let matriculaProfesional = '';
  let acreditacionSenasa = '';
  let operadorConsignatario = '';
  let tipoComprador: TipoComprador = 'FRIGORIFICO_EXPORTADOR';
  let matriculaRuca = '';

  if (rol === 'VETERINARIO') {
    matriculaProfesional = entrada.matricula_profesional?.trim() ?? '';
    acreditacionSenasa = entrada.acreditacion_senasa?.trim() ?? '';
    if (!matriculaProfesional) {
      errors.push('La matrícula profesional es obligatoria para veterinarios.');
    }
  } else if (rol === 'PRODUCTOR') {
    operadorConsignatario = entrada.operador_consignatario?.trim() ?? '';
  } else if (rol === 'COMPRADOR') {
    const rawTipo = entrada.tipo_comprador ?? 'FRIGORIFICO_EXPORTADOR';
    if ((TIPOS_COMPRADOR as readonly string[]).includes(rawTipo)) {
      tipoComprador = rawTipo as TipoComprador;
    }
    matriculaRuca = entrada.matricula_ruca?.trim() ?? '';
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    datos: {
      rol: rol as RolUsuario,
      nombreCompleto,
      cuit,
      email,
      password,
      matriculaProfesional,
      acreditacionSenasa,
      operadorConsignatario,
      tipoComprador,
      matriculaRuca,
    },
  };
}

export function canPerformStage(user: PerfilUsuario | null | undefined, stage: Stage): boolean {
  switch (stage) {
    case 'PASO_1_CREAR_LOTE':
    case 'PASO_4A_DESPACHO':
      return user?.rol === 'PRODUCTOR';
    case 'PASO_2_FONDEAR_ESCROW':
      return user?.rol === 'COMPRADOR';
    case 'PASO_4B_RECEPCION':
      return user?.rol === 'COMPRADOR' || user?.rol === 'FRIGORIFICO';
    case 'PASO_3_AUDITORIA_VET':
      return user?.rol === 'VETERINARIO';
    case 'PASO_5_PASAPORTE':
    case 'MERCADO':
      return true;
    default:
      return false;
  }
}

export function identidadProductor(user: PerfilUsuario): { nombre: string; cuit: string } {
  return { nombre: user.nombre_completo.trim(), cuit: user.cuit.trim() };
}

export function esDuenoDelLote(
  user: PerfilUsuario,
  lote: { productor_id?: string | null; productor_wallet?: string | null },
): boolean {
  const normalizarWallet = (wallet?: string | null) => wallet?.trim().toUpperCase() ?? null;
  const coincideProductor = Boolean(
    user.productor_id && lote.productor_id && user.productor_id === lote.productor_id,
  );
  const walletUsuario = normalizarWallet(user.wallet);
  const walletLote = normalizarWallet(lote.productor_wallet);
  const coincideWallet = Boolean(walletUsuario && walletUsuario === walletLote);
  return coincideProductor || coincideWallet;
}

export async function getCurrentUser(): Promise<PerfilUsuario | null> {
  try {
    const cookieStore = await cookies();
    const demoRol = cookieStore.get('muunar_demo_rol')?.value;
    if (demoRol === 'FRIGORIFICO') {
      const demo = DEMO_USERS.FRIGORIFICO;
      return {
        id: 'mock-frigorifico-id',
        rol: 'FRIGORIFICO',
        nombre_completo: demo.nombre_completo,
        cuit: demo.cuit,
        matricula: null,
        tipo_comprador: demo.tipo_comprador ?? 'FRIGORIFICO_EXPORTADOR',
        wallet: demo.wallet,
        productor_id: null,
        veterinario_id: null,
        comprador_id: null,
        email: demo.email ?? null,
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!perfil) return null;

    return {
      id: perfil.id,
      rol: perfil.rol as RolUsuario,
      nombre_completo: perfil.nombre_completo,
      cuit: perfil.cuit,
      matricula: perfil.matricula ?? null,
      tipo_comprador: perfil.tipo_comprador ?? null,
      wallet: perfil.wallet ?? null,
      productor_id: perfil.productor_id ?? null,
      veterinario_id: perfil.veterinario_id ?? null,
      comprador_id: perfil.comprador_id ?? null,
      email: user.email ?? null,
    };
  } catch {
    return null;
  }
}

export async function ensureDemoUser(rol: RolUsuario) {
  if (rol === 'FRIGORIFICO') {
    return { email: DEMO_USERS.FRIGORIFICO.email, password: DEMO_USERS.FRIGORIFICO.password };
  }
  const demo = DEMO_USERS[rol];
  const admin = createAdminClient();

  const { data: usersData } = await admin.auth.admin.listUsers();
  const legacyEmail = demo.email.replace('@muunar.agro', '@neatech.agro');
  let user = usersData?.users.find(
    (u) =>
      u.email?.toLowerCase() === demo.email.toLowerCase() ||
      u.email?.toLowerCase() === legacyEmail.toLowerCase(),
  );

  if (!user) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: demo.email,
      password: demo.password,
      email_confirm: true,
      user_metadata: { rol: demo.rol, nombre_completo: demo.nombre_completo },
    });
    if (error || !created.user) {
      throw new Error(`Error creando usuario demo ${rol}: ${error?.message}`);
    }
    user = created.user;
  } else {
    // Sincronizar email actual (@muunar.agro) y contraseña para que las credenciales siempre coincidan
    const { data: updated } = await admin.auth.admin.updateUserById(user.id, {
      email: demo.email,
      password: demo.password,
      email_confirm: true,
    });
    if (updated?.user) {
      user = updated.user;
    }
  }

  let productorId: string | null = null;
  let veterinarioId: string | null = null;
  let compradorId: string | null = null;

  if (rol === 'PRODUCTOR') {
    const { data: prod } = await admin
      .from('productores')
      .upsert(
        {
          wallet: demo.wallet,
          nombre_razon_social: demo.nombre_completo,
          cuit: demo.cuit,
          operador_consignatario: demo.operador_consignatario ?? null,
          anos_operando: demo.anos_operando ?? null,
        },
        { onConflict: 'wallet' },
      )
      .select('id')
      .single();
    productorId = prod?.id ?? null;
  } else if (rol === 'VETERINARIO') {
    const { data: vet } = await admin
      .from('veterinarios')
      .upsert(
        {
          wallet: demo.wallet,
          nombre_completo: demo.nombre_completo,
          cuit: demo.cuit,
          matricula_profesional: demo.matricula ?? 'MP-4102 SENASA',
          acreditacion_senasa: demo.acreditacion_senasa ?? null,
        },
        { onConflict: 'wallet' },
      )
      .select('id')
      .single();
    veterinarioId = vet?.id ?? null;
  } else if (rol === 'COMPRADOR') {
    const { data: comp } = await admin
      .from('compradores')
      .upsert(
        {
          wallet: demo.wallet,
          razon_social: demo.nombre_completo,
          cuit: demo.cuit,
          tipo_comprador: demo.tipo_comprador ?? 'FRIGORIFICO_EXPORTADOR',
          matricula_ruca: demo.matricula_ruca ?? null,
        },
        { onConflict: 'wallet' },
      )
      .select('id')
      .single();
    compradorId = comp?.id ?? null;
  }

  await admin.from('perfiles').upsert(
    {
      id: user.id,
      rol: demo.rol,
      nombre_completo: demo.nombre_completo,
      cuit: demo.cuit,
      matricula: demo.matricula ?? null,
      tipo_comprador: demo.tipo_comprador ?? null,
      wallet: demo.wallet,
      productor_id: productorId,
      veterinario_id: veterinarioId,
      comprador_id: compradorId,
    },
    { onConflict: 'id' },
  );

  return { email: user.email ?? demo.email, password: demo.password };
}

export { loginAction, registerAction, loginDemoAction, logoutAction } from './auth-actions';
