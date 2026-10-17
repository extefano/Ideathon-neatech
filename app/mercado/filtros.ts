export type FiltrosHumedal = {
  min: number | null;
  max: number | null;
  sinDato: boolean;
  errores: string[];
};

type ParametrosCrudos = Record<string, string | string[] | undefined>;

function primerValor(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? '';
  return valor ?? '';
}

/**
 * Filtros de humedal del mercado. Reglas:
 * - Rango inclusivo [min, max] entre 0 y 100 (nunca aplica a desconocidos).
 * - "Solo sin dato" (`humSinDato=1`) muestra exclusivamente lotes sin porcentaje.
 * - Rango y "sin dato" juntos son contradictorios: se rechazan con un error claro.
 * - Parámetros repetidos: se conserva el primero.
 */
export function parsearFiltrosHumedal(sp: ParametrosCrudos): FiltrosHumedal {
  const errores: string[] = [];
  const crudoMin = primerValor(sp.humMin).trim();
  const crudoMax = primerValor(sp.humMax).trim();
  const sinDato = primerValor(sp.humSinDato) === '1';

  const parsear = (crudo: string, nombre: string): number | null => {
    if (!crudo) return null;
    const n = Number(crudo);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errores.push(`El ${nombre} de humedal debe ser un número entre 0 y 100.`);
      return null;
    }
    return n;
  };

  const min = parsear(crudoMin, 'mínimo');
  const max = parsear(crudoMax, 'máximo');

  if (min !== null && max !== null && min > max) {
    errores.push('El mínimo de humedal no puede ser mayor que el máximo.');
  }

  if (sinDato && (min !== null || max !== null)) {
    errores.push('Elegí un rango de humedal o «solo sin dato», no ambos a la vez.');
  }

  return { min, max, sinDato, errores };
}

export function hayFiltrosHumedal(filtros: FiltrosHumedal): boolean {
  return filtros.min !== null || filtros.max !== null || filtros.sinDato;
}

export type FiltrosMercado = {
  provincia?: string;
  categoria?: string;
  raza?: string;
  moneda?: string;
};

/**
 * Filtros de mercado (provincia, categoría, raza y moneda) listos para pasar
 * como opciones de `listarLotes`, que los aplica en la consulta antes del
 * límite. Parámetros vacíos o en blanco no filtran; los repetidos conservan
 * el primero.
 */
export function parsearFiltrosMercado(sp: ParametrosCrudos): FiltrosMercado {
  const limpiar = (valor: string | string[] | undefined): string | undefined => {
    const texto = primerValor(valor).trim();
    return texto === '' ? undefined : texto;
  };

  return {
    provincia: limpiar(sp.provincia),
    categoria: limpiar(sp.categoria),
    raza: limpiar(sp.raza),
    moneda: limpiar(sp.moneda),
  };
}

export function hayFiltrosMercado(filtros: FiltrosMercado): boolean {
  return Object.values(filtros).some(Boolean);
}
