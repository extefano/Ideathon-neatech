import { describe, expect, it } from 'vitest';
import { generarLotes, opcionesPorDefecto } from '../lib/generar-lotes';
import { escaparTexto, renderMigracion } from '../lib/render-sql';

describe('Render de la migración SQL demo (#45)', () => {
  const lotes = generarLotes({ ...opcionesPorDefecto(), count: 5, seed: 12345 });

  it('escapa literales de texto duplicando comillas simples', () => {
    expect(escaparTexto("O'Higgins")).toBe("'O''Higgins'");
  });

  it('emite una transacción idempotente con guardia y WHERE NOT EXISTS', () => {
    const sql = renderMigracion(lotes, {
      count: lotes.length,
      seed: 12345,
      estado: 'DISPONIBLE',
      certificaciones: false,
    });

    expect(sql).toContain('begin;');
    expect(sql).toContain('commit;');
    expect(sql).toContain('raise exception');
    expect(sql).toContain("codigo_lote like 'LOTE-DEMO-%'");
    expect(sql.match(/insert into public\.lotes/g)).toHaveLength(lotes.length);
    expect(sql.match(/insert into public\.caravanas/g)).toHaveLength(lotes.length);
    expect(sql.match(/where not exists \(select 1 from public\.lotes/g)).toHaveLength(lotes.length);
    expect(sql).toContain("'DISPONIBLE'");
    expect(sql).toContain('::jsonb');
    expect(sql).not.toContain('soroban');
  });

  it('es reproducible para el mismo input', () => {
    const meta = {
      count: lotes.length,
      seed: 12345,
      estado: 'DISPONIBLE' as const,
      certificaciones: false,
    };
    expect(renderMigracion(lotes, meta)).toBe(renderMigracion(lotes, meta));
  });
});
