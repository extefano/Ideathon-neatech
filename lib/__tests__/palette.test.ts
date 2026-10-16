import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EstadoBadge } from '@/components/estado-badge';
import type { EstadoLote } from '@/lib/domain';

function listarArchivos(dir: string): string[] {
  const resultado: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      resultado.push(...listarArchivos(ruta));
    } else if (/\.(ts|tsx|css)$/.test(entrada)) {
      resultado.push(ruta);
    }
  }
  return resultado;
}

describe('Paleta Stellar (#FDDA24 + negro + blanco)', () => {
  it('define el token --color-brand: #fdda24 en app/globals.css', () => {
    const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
    expect(css).toMatch(/--color-brand:\s*#fdda24/i);
  });

  it('no usa colores heredados (emerald, sky, indigo, violet, amber, #34d399) en app/ ni components/', () => {
    const archivos = [
      ...listarArchivos(join(process.cwd(), 'app')),
      ...listarArchivos(join(process.cwd(), 'components')),
    ];

    for (const archivo of archivos) {
      const contenido = readFileSync(archivo, 'utf8');
      expect(contenido, `Color heredado en ${archivo}`).not.toMatch(
        /\b(emerald|sky|indigo|violet|amber)-\d+|#34d399/i,
      );
    }
  });

  it('los elementos con fondo sólido bg-brand usan texto oscuro (text-neutral-950) y nunca text-white', () => {
    const archivos = [
      ...listarArchivos(join(process.cwd(), 'app')),
      ...listarArchivos(join(process.cwd(), 'components')),
    ];

    const ocurrenciasBgBrand: string[] = [];
    for (const archivo of archivos) {
      const contenido = readFileSync(archivo, 'utf8');
      const matches = contenido.match(/className="[^"]*\bbg-brand(?![/\w-])[^"]*"/g) ?? [];
      for (const m of matches) {
        ocurrenciasBgBrand.push(`${archivo}: ${m}`);
        expect(m).toContain('text-neutral-950');
        expect(m).not.toContain('text-white');
      }
    }
    expect(ocurrenciasBgBrand.length).toBeGreaterThan(0);
  });

  it('EstadoBadge mapea los estados a la paleta y reserva rojo solo para RECHAZADO_EUDR', () => {
    const estados: EstadoLote[] = [
      'PENDIENTE_VALIDACION',
      'DISPONIBLE',
      'RECHAZADO_EUDR',
      'FINANCIADO_EN_ENGORDE',
      'EN_TRANSITO_A_FRIGORIFICO',
      'CERRADO_CICLO',
    ];

    for (const estado of estados) {
      const elemento = EstadoBadge({ estado }) as { props: { className: string } };
      const cls = elemento.props.className;
      if (estado === 'RECHAZADO_EUDR') {
        expect(cls).toContain('red-');
      } else {
        expect(cls).not.toContain('red-');
      }
      if (/\bbg-brand(?![/\w-])/.test(cls)) {
        expect(cls).toContain('text-neutral-950');
      }
    }
  });
});
