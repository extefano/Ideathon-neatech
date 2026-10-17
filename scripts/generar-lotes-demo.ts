import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { MONEDAS } from '../lib/domain';
import {
  MAX_LOTES,
  PROVINCIAS_NOMBRES,
  generarLotes,
  opcionesPorDefecto,
  validarOpciones,
  type EstadoGenerable,
  type Moneda,
  type OpcionesGenerador,
} from './lib/generar-lotes';
import { renderMigracion } from './lib/render-sql';

const AYUDA = `Generador de lotes demo para la migración SQL del marketplace (#45).

Uso:
  pnpm generate:lots -- --count 40 --seed 12345 [opciones]

Opciones:
  --count <n>           Cantidad de lotes (1..${MAX_LOTES}). Default: 40.
  --seed <n>            Semilla del PRNG (reproducible). Default: 12345.
  --estado <valor>      Solo DISPONIBLE (default).
  --provincias a,b,c    Provincias a usar. Default: las 23.
  --monedas USDC,EURC   Monedas. Default: USDC,EURC.
  --min-cabezas <n>     Cabezas mínimas por lote. Default: 20.
  --max-cabezas <n>     Cabezas máximas por lote. Default: 80.
  --certificaciones     Adjunta las 3 certificaciones Eje 2 (marcadas [DEMO]).
  --out <path>          Ruta de salida. Default: supabase/migrations/<ts>_seed_demo_lots.sql.
  --dry-run             Imprime el SQL por stdout sin escribir archivos.
  --help                Muestra esta ayuda.

Provincias válidas: ${PROVINCIAS_NOMBRES.join(', ')}
Monedas válidas: ${MONEDAS.join(', ')}`;

type ArgsParseados = {
  opciones: OpcionesGenerador;
  out?: string;
  dryRun: boolean;
  help: boolean;
};

function parseEntero(valor: string, flag: string): number {
  if (!/^-?\d+$/.test(valor)) {
    throw new Error(`${flag} debe ser un entero (recibido: "${valor}").`);
  }
  return Number.parseInt(valor, 10);
}

function parsearArgs(argv: readonly string[]): ArgsParseados {
  const opciones = opcionesPorDefecto();
  let out: string | undefined;
  let dryRun = false;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const leerValor = (): string => {
      const valor = argv[i + 1];
      if (valor === undefined || valor.startsWith('--')) {
        throw new Error(`Falta el valor de ${arg}.`);
      }
      i += 1;
      return valor;
    };
    const lista = (valor: string, flag: string): string[] => {
      const items = valor
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (items.length === 0) throw new Error(`${flag} no puede quedar vacío.`);
      return items;
    };

    switch (arg) {
      case '--count':
        opciones.count = parseEntero(leerValor(), '--count');
        break;
      case '--seed':
        opciones.seed = parseEntero(leerValor(), '--seed');
        break;
      case '--estado':
        opciones.estado = leerValor() as EstadoGenerable;
        break;
      case '--provincias':
        opciones.provincias = lista(leerValor(), '--provincias');
        break;
      case '--monedas':
        opciones.monedas = lista(leerValor(), '--monedas') as Moneda[];
        break;
      case '--min-cabezas':
        opciones.minCabezas = parseEntero(leerValor(), '--min-cabezas');
        break;
      case '--max-cabezas':
        opciones.maxCabezas = parseEntero(leerValor(), '--max-cabezas');
        break;
      case '--certificaciones':
        opciones.certificaciones = true;
        break;
      case '--out':
        out = leerValor();
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--help':
      case '-h':
        help = true;
        break;
      default:
        throw new Error(`Argumento desconocido: "${arg}". Usá --help para ver las opciones.`);
    }
  }

  return { opciones, out, dryRun, help };
}

function nombreArchivoPorDefecto(): string {
  const marca = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `supabase/migrations/${marca}_seed_demo_lots.sql`;
}

function main(): void {
  const parseados = parsearArgs(process.argv.slice(2));
  if (parseados.help) {
    process.stdout.write(`${AYUDA}\n`);
    return;
  }

  const opciones = validarOpciones(parseados.opciones);
  const lotes = generarLotes(opciones);
  const sql = renderMigracion(lotes, {
    count: opciones.count,
    seed: opciones.seed,
    estado: opciones.estado,
    certificaciones: opciones.certificaciones,
  });

  if (parseados.dryRun) {
    process.stdout.write(sql);
    process.stderr.write(
      `[dry-run] ${lotes.length} lotes generados (seed=${opciones.seed}). No se escribió ningún archivo.\n`,
    );
    return;
  }

  const destino = resolve(process.cwd(), parseados.out ?? nombreArchivoPorDefecto());
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, sql, 'utf8');
  process.stderr.write(`Migración generada: ${destino}\n`);
  process.stderr.write(
    `Lotes: ${lotes.length} · seed=${opciones.seed} · estado=${opciones.estado} · certificaciones=${opciones.certificaciones}\n`,
  );
}

try {
  main();
} catch (error) {
  const mensaje = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${mensaje}\n`);
  process.exitCode = 1;
}
