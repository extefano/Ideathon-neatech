import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@/lib/crypto';
import { jsonCanonico } from '@/lib/json-canonico';

describe('jsonCanonico (canonicalización v1)', () => {
  it('ordena las claves de objetos de forma recursiva', () => {
    expect(jsonCanonico({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(jsonCanonico({ b: { d: 1, c: 2 }, a: [{ z: 1, y: 2 }] })).toBe(
      '{"a":[{"y":2,"z":1}],"b":{"c":2,"d":1}}',
    );
  });

  it('preserva el orden de los arrays', () => {
    expect(jsonCanonico([2, 1])).toBe('[2,1]');
  });

  it('produce bytes estables e independientes del orden de construcción', () => {
    const original = { b: [1, 2, { d: null, c: 'á"é' }], a: -12.5 };
    const reordenado = { a: -12.5, b: [1, 2, { c: 'á"é', d: null }] };

    const esperado = '{"a":-12.5,"b":[1,2,{"c":"á\\"é","d":null}]}';

    expect(jsonCanonico(original)).toBe(esperado);
    expect(jsonCanonico(reordenado)).toBe(esperado);
    expect(sha256Hex(jsonCanonico(original))).toBe(
      'a22924d4da974edeafd5c6461f378bf444d5f950c2682ce5eaa235988f4bc532',
    );
  });

  it('normaliza -0 y rechaza números no finitos o valores undefined', () => {
    expect(jsonCanonico(-0)).toBe('0');
    expect(() => jsonCanonico(Number.NaN)).toThrow('no finito');
    expect(() => jsonCanonico(Number.POSITIVE_INFINITY)).toThrow('no finito');
    expect(() => jsonCanonico({ a: undefined })).toThrow('undefined');
  });

  it('rechaza tipos no serializables', () => {
    expect(() => jsonCanonico(() => 1)).toThrow('no soportado');
  });
});
