import { describe, expect, it } from 'vitest';
import {
  canPerformStage,
  DEMO_USERS,
  rutaInternaSegura,
  validarDatosRegistro,
  type PerfilUsuario,
  type RolUsuario,
} from '../auth';

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
    email: `${rol.toLowerCase()}@muunar.test`,
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

describe('rutaInternaSegura (sanitización de redirects)', () => {
  it('deja pasar rutas internas', () => {
    expect(rutaInternaSegura('/lotes/123')).toBe('/lotes/123');
    expect(rutaInternaSegura('/')).toBe('/');
    expect(rutaInternaSegura('/login?redirectTo=/mercado')).toBe('/login?redirectTo=/mercado');
  });

  it('rechaza rutas protocol-relative y URLs externas', () => {
    expect(rutaInternaSegura('//evil.com')).toBe('/');
    expect(rutaInternaSegura('/\\evil.com')).toBe('/');
    expect(rutaInternaSegura('https://evil.com')).toBe('/');
    expect(rutaInternaSegura('javascript:alert(1)')).toBe('/');
  });

  it('usa la ruta alterna ante valores vacíos o inválidos', () => {
    expect(rutaInternaSegura(null)).toBe('/');
    expect(rutaInternaSegura(undefined)).toBe('/');
    expect(rutaInternaSegura('')).toBe('/');
    expect(rutaInternaSegura(undefined, '/mercado')).toBe('/mercado');
    expect(rutaInternaSegura('https://evil.com', '/mercado')).toBe('/mercado');
    expect(rutaInternaSegura('//evil.com', '/mercado')).toBe('/mercado');
  });
});

describe('validarDatosRegistro', () => {
  it('acepta un productor con credenciales y normaliza espacios', () => {
    const resultado = validarDatosRegistro(
      {
        rol: 'PRODUCTOR',
        nombre_completo: '  Cabaña La Tranquera ',
        cuit: ' 30-71234567-8 ',
        email: 'productor@campo.com',
        password: 'secreto123',
        operador_consignatario: ' Consignataria del Sur ',
      },
      { requiereCredenciales: true },
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.datos.rol).toBe('PRODUCTOR');
      expect(resultado.datos.nombreCompleto).toBe('Cabaña La Tranquera');
      expect(resultado.datos.cuit).toBe('30-71234567-8');
      expect(resultado.datos.operadorConsignatario).toBe('Consignataria del Sur');
    }
  });

  it('exige matrícula profesional para veterinarios', () => {
    const resultado = validarDatosRegistro(
      {
        rol: 'VETERINARIO',
        nombre_completo: 'Dra. Valeria Gómez',
        cuit: '27-33445566-9',
        email: 'vet@campo.com',
        password: 'secreto123',
        matricula_profesional: '   ',
      },
      { requiereCredenciales: true },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.errors).toContain(
        'La matrícula profesional es obligatoria para veterinarios.',
      );
    }
  });

  it('valida el tipo de comprador contra la lista canónica', () => {
    const invalido = validarDatosRegistro(
      {
        rol: 'COMPRADOR',
        nombre_completo: 'Frigorífico Export SA',
        cuit: '30-61234567-1',
        email: 'compra@frigo.com',
        password: 'secreto123',
        tipo_comprador: 'NO_EXISTE',
      },
      { requiereCredenciales: true },
    );

    expect(invalido.ok).toBe(true);
    if (invalido.ok) {
      expect(invalido.datos.tipoComprador).toBe('FRIGORIFICO_EXPORTADOR');
    }

    const valido = validarDatosRegistro(
      {
        rol: 'COMPRADOR',
        nombre_completo: 'Frigorífico Export SA',
        cuit: '30-61234567-1',
        email: 'compra@frigo.com',
        password: 'secreto123',
        tipo_comprador: 'CONSIGNATARIA',
      },
      { requiereCredenciales: true },
    );

    expect(valido.ok).toBe(true);
    if (valido.ok) {
      expect(valido.datos.tipoComprador).toBe('CONSIGNATARIA');
    }
  });

  it('no exige correo ni contraseña cuando requiereCredenciales es false (alta sin credenciales)', () => {
    const resultado = validarDatosRegistro(
      {
        rol: 'PRODUCTOR',
        nombre_completo: 'Cabaña La Tranquera',
        cuit: '30-71234567-8',
      },
      { requiereCredenciales: false },
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.datos.email).toBe('');
      expect(resultado.datos.password).toBe('');
    }
  });

  it('rechaza roles inválidos y campos obligatorios vacíos', () => {
    const resultado = validarDatosRegistro(
      { rol: 'ADMIN', nombre_completo: ' ', cuit: '', email: 'sin-arroba', password: '123' },
      { requiereCredenciales: true },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.errors).toContain('El rol seleccionado no es válido.');
      expect(resultado.errors).toContain('El nombre o razón social es obligatorio.');
      expect(resultado.errors).toContain('El CUIT es obligatorio.');
      expect(resultado.errors).toContain('Ingresá un correo electrónico válido.');
      expect(resultado.errors).toContain('La contraseña debe tener al menos 6 caracteres.');
    }
  });
});
