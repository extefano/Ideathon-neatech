export type Desembolsos = { hito1: number; hito2: number; hito3: number };

export type LiquidacionFinal = {
  deduccion: number;
  pagoProductor: number;
  reembolsoComprador: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcularDesembolsos(montoTotal: number): Desembolsos {
  return {
    hito1: round2(montoTotal * 0.4),
    hito2: round2(montoTotal * 0.3),
    hito3: round2(montoTotal * 0.3),
  };
}

export function calcularLiquidacionFinal(opts: {
  montoTotal: number;
  tramoFinal: number;
  pesoObjetivoKg: number;
  pesoFinalKg: number;
}): LiquidacionFinal {
  const { montoTotal, tramoFinal, pesoObjetivoKg, pesoFinalKg } = opts;

  if (pesoFinalKg >= pesoObjetivoKg || pesoObjetivoKg <= 0) {
    return { deduccion: 0, pagoProductor: round2(tramoFinal), reembolsoComprador: 0 };
  }

  const faltantePct = (pesoObjetivoKg - pesoFinalKg) / pesoObjetivoKg;
  const deduccion = round2(Math.min(tramoFinal, montoTotal * faltantePct));

  return {
    deduccion,
    pagoProductor: round2(tramoFinal - deduccion),
    reembolsoComprador: deduccion,
  };
}
