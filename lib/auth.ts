import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/storage';

export type RolUsuario = 'PRODUCTOR' | 'VETERINARIO' | 'COMPRADOR';

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
    tipo_comprador?: 'FRIGORIFICO_EXPORTADOR' | 'INVERSOR_AGRO' | 'CONSIGNATARIA';
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
};

export function canPerformStage(user: PerfilUsuario | null | undefined, stage: Stage): boolean {
  switch (stage) {
    case 'PASO_1_CREAR_LOTE':
    case 'PASO_4A_DESPACHO':
      return user?.rol === 'PRODUCTOR';
    case 'PASO_2_FONDEAR_ESCROW':
    case 'PASO_4B_RECEPCION':
      return user?.rol === 'COMPRADOR';
    case 'PASO_3_AUDITORIA_VET':
      return user?.rol === 'VETERINARIO';
    case 'PASO_5_PASAPORTE':
    case 'MERCADO':
      return true;
    default:
      return false;
  }
}

export async function getCurrentUser(): Promise<PerfilUsuario | null> {
  try {
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
