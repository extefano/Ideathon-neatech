export type GfwAnio = { year: number; lossHa: number };

export type GfwResult = {
  totalLossHa: number;
  byYear: GfwAnio[];
  checkedAt: string;
  criterio: string;
};

const GFW_URL =
  'https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss/latest/query/json';

const SQL = `SELECT umd_tree_cover_loss__year, SUM(area__ha) AS loss_ha FROM results WHERE umd_tree_cover_loss__year >= 2021 GROUP BY umd_tree_cover_loss__year ORDER BY umd_tree_cover_loss__year ASC`;

export async function consultarDeforestacion(opts: {
  geometry: unknown;
  apiKey: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}): Promise<GfwResult> {
  const fetchFn = opts.fetchImpl ?? fetch;

  const res = await fetchFn(GFW_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
    },
    body: JSON.stringify({ sql: SQL, geometry: opts.geometry }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Global Forest Watch respondió ${res.status}`);
  }

  const json = (await res.json()) as { data?: unknown };
  const rows = Array.isArray(json.data) ? json.data : [];

  const byYear: GfwAnio[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const year = Number(r['umd_tree_cover_loss__year']);
    const lossHa = Number(r['loss_ha'] ?? 0);
    if (Number.isFinite(year) && Number.isFinite(lossHa)) {
      byYear.push({ year, lossHa: round2(lossHa) });
    }
  }

  const totalLossHa = round2(byYear.reduce((a, r) => a + r.lossHa, 0));

  return {
    totalLossHa,
    byYear,
    checkedAt: (opts.now?.() ?? new Date()).toISOString(),
    criterio: 'umd_tree_cover_loss >= 2021 (corte reglamentario EUDR: 31/12/2020)',
  };
}

export function hayDeforestacion(result: GfwResult): boolean {
  return result.totalLossHa > 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
