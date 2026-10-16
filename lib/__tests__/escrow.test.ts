import { describe, expect, it } from 'vitest';
import { calcularDesembolsos, calcularLiquidacionFinal } from '@/lib/escrow';

describe('calcularDesembolsos', () => {
  it('reparte 40/30/30 sobre el monto total', () => {
    expect(calcularDesembolsos(10000)).toEqual({ hito1: 4000, hito2: 3000, hito3: 3000 });
  });

  it('redondea a 2 decimales', () => {
    expect(calcularDesembolsos(1234.567)).toEqual({ hito1: 493.83, hito2: 370.37, hito3: 370.37 });
  });
});

describe('calcularLiquidacionFinal', () => {
  it('sin faltante paga el tramo final completo', () => {
    const r = calcularLiquidacionFinal({
      montoTotal: 10000,
      tramoFinal: 3000,
      pesoObjetivoKg: 460,
      pesoFinalKg: 465,
    });

    expect(r).toEqual({ deduccion: 0, pagoProductor: 3000, reembolsoComprador: 0 });
  });

  it('con faltante deduce proporcional al peso pactado', () => {
    const r = calcularLiquidacionFinal({
      montoTotal: 10000,
      tramoFinal: 3000,
      pesoObjetivoKg: 460,
      pesoFinalKg: 414,
    });

    expect(r.deduccion).toBe(1000);
    expect(r.pagoProductor).toBe(2000);
    expect(r.reembolsoComprador).toBe(1000);
  });

  it('la deducción nunca supera el tramo final', () => {
    const r = calcularLiquidacionFinal({
      montoTotal: 10000,
      tramoFinal: 3000,
      pesoObjetivoKg: 460,
      pesoFinalKg: 100,
    });

    expect(r.deduccion).toBe(3000);
    expect(r.pagoProductor).toBe(0);
    expect(r.reembolsoComprador).toBe(3000);
  });
});
