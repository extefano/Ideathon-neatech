import { describe, expect, it } from 'vitest';
import { canPerformStage, DEMO_USERS, type PerfilUsuario, type RolUsuario } from '../auth';

function crearUsuarioMock(rol: RolUsuario, extra: Partial<PerfilUsuario> = {}): PerfilUsuario {
  return {
    id: `mock-${rol.toLowerCase()}-id`,
    rol,
    nombre_completo: `Usuario ${rol}`,
    cuit: '20-12345678-9',
    matricula: rol === 'VETERINARIO' ? 'MP-9999' : null,
    tipo_comprador: rol === 'COMPRADOR' ? 'FRIGORIFICO_EXPORTADOR' : null,
    wallet: `GDEMO-${rol}`,
    productor_id: null,
    veterinario_id: null,
    comprador_id: null,
    email: `${rol.toLowerCase()}@neatech.test`,
    ...extra,
  };
}

describe('canPerformStage (matriz de permisos por etapa)', () => {
  const productor = crearUsuarioMock('PRODUCTOR');
  const veterinario = crearUsuarioMock('VETERINARIO');
  const comprador = crearUsuarioMock('COMPRADOR');

  it('Paso 1 (Crear lote): solo permitido para PRODUCTOR', () => {
    expect(canPerformStage(productor, 'PASO_1_CREAR_LOTE')).toBe(true);
    expect(canPerformStage(veterinario, 'PASO_1_CREAR_LOTE')).toBe(false);
    expect(canPerformStage(comprador, 'PASO_1_CREAR_LOTE')).toBe(false);
    expect(canPerformStage(null, 'PASO_1_CREAR_LOTE')).toBe(false);
  });

  it('Paso 2 (Fondear escrow): solo permitido para COMPRADOR', () => {
    expect(canPerformStage(comprador, 'PASO_2_FONDEAR_ESCROW')).toBe(true);
    expect(canPerformStage(productor, 'PASO_2_FONDEAR_ESCROW')).toBe(false);
    expect(canPerformStage(veterinario, 'PASO_2_FONDEAR_ESCROW')).toBe(false);
    expect(canPerformStage(null, 'PASO_2_FONDEAR_ESCROW')).toBe(false);
  });

  it('Paso 3 (Auditoría Mes 4): solo permitido para VETERINARIO (productor prohibido)', () => {
    expect(canPerformStage(veterinario, 'PASO_3_AUDITORIA_VET')).toBe(true);
    expect(canPerformStage(productor, 'PASO_3_AUDITORIA_VET')).toBe(false);
    expect(canPerformStage(comprador, 'PASO_3_AUDITORIA_VET')).toBe(false);
    expect(canPerformStage(null, 'PASO_3_AUDITORIA_VET')).toBe(false);
  });

  it('Paso 4A (Despacho DT-e): solo permitido para PRODUCTOR', () => {
    expect(canPerformStage(productor, 'PASO_4A_DESPACHO')).toBe(true);
    expect(canPerformStage(veterinario, 'PASO_4A_DESPACHO')).toBe(false);
    expect(canPerformStage(comprador, 'PASO_4A_DESPACHO')).toBe(false);
    expect(canPerformStage(null, 'PASO_4A_DESPACHO')).toBe(false);
  });

  it('Paso 4B (Recepción balanza): solo permitido para COMPRADOR', () => {
    expect(canPerformStage(comprador, 'PASO_4B_RECEPCION')).toBe(true);
    expect(canPerformStage(productor, 'PASO_4B_RECEPCION')).toBe(false);
    expect(canPerformStage(veterinario, 'PASO_4B_RECEPCION')).toBe(false);
    expect(canPerformStage(null, 'PASO_4B_RECEPCION')).toBe(false);
  });

  it('Paso 5 (Pasaporte) y Mercado: 100% públicos para cualquiera o sin sesión', () => {
    expect(canPerformStage(null, 'PASO_5_PASAPORTE')).toBe(true);
    expect(canPerformStage(productor, 'PASO_5_PASAPORTE')).toBe(true);
    expect(canPerformStage(veterinario, 'PASO_5_PASAPORTE')).toBe(true);
    expect(canPerformStage(comprador, 'PASO_5_PASAPORTE')).toBe(true);

    expect(canPerformStage(null, 'MERCADO')).toBe(true);
    expect(canPerformStage(productor, 'MERCADO')).toBe(true);
  });
});

describe('DEMO_USERS (cuentas de evaluación rápida)', () => {
  it('contiene la configuración base para los tres roles', () => {
    expect(DEMO_USERS.PRODUCTOR).toBeDefined();
    expect(DEMO_USERS.VETERINARIO).toBeDefined();
    expect(DEMO_USERS.COMPRADOR).toBeDefined();

    expect(DEMO_USERS.PRODUCTOR.rol).toBe('PRODUCTOR');
    expect(DEMO_USERS.PRODUCTOR.nombre_completo).toBe('Cabaña Las Lilas SA');
    expect(DEMO_USERS.PRODUCTOR.wallet).toBe('GDEMO-PRODUCTOR');

    expect(DEMO_USERS.VETERINARIO.rol).toBe('VETERINARIO');
    expect(DEMO_USERS.VETERINARIO.nombre_completo).toBe('Dr. Carlos Saavedra');
    expect(DEMO_USERS.VETERINARIO.matricula).toBe('MP-4102 SENASA');

    expect(DEMO_USERS.COMPRADOR.rol).toBe('COMPRADOR');
    expect(DEMO_USERS.COMPRADOR.nombre_completo).toBe('Frigorífico Rioplatense SA');
    expect(DEMO_USERS.COMPRADOR.tipo_comprador).toBe('FRIGORIFICO_EXPORTADOR');
  });
});
