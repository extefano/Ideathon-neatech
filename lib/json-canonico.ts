/**
 * Canonicalización JSON v1 de Muunar (subconjunto determinista de JCS):
 * - Claves de objetos ordenadas recursivamente por unidades de código UTF-16.
 * - Sin espacios ni saltos de línea decorativos.
 * - Arrays conservan su orden.
 * - Solo valores finitos: NaN, Infinity y undefined se rechazan.
 *
 * Los bytes de salida son los que se hashean y persisten; nunca se
 * re-serializan desde la base para comparar hashes.
 */
export function jsonCanonico(valor: unknown): string {
  return serializar(valor);
}

function serializar(valor: unknown): string {
  if (valor === null) return 'null';

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) {
      throw new Error('JSON canónico: número no finito');
    }
    return JSON.stringify(valor);
  }

  if (typeof valor === 'string' || typeof valor === 'boolean') {
    return JSON.stringify(valor);
  }

  if (Array.isArray(valor)) {
    return `[${valor.map(serializar).join(',')}]`;
  }

  if (typeof valor === 'object') {
    const registro = valor as Record<string, unknown>;
    const claves = Object.keys(registro).sort();
    const partes = claves.map((clave) => {
      const hijo = registro[clave];
      if (hijo === undefined) {
        throw new Error(`JSON canónico: la clave "${clave}" tiene valor undefined`);
      }
      return `${JSON.stringify(clave)}:${serializar(hijo)}`;
    });
    return `{${partes.join(',')}}`;
  }

  throw new Error('JSON canónico: tipo de valor no soportado');
}
