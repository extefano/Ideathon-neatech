import { describe, expect, it } from 'vitest';
import { FakeStellarClient, getStellarClient } from '@/lib/stellar';

const input = { codigoLote: 'LOTE-00104', buyerWallet: 'GABCDEMO', amount: 10000 };

describe('FakeStellarClient (modo demo)', () => {
  it('genera un tx hash determinista con formato y link a Stellar Expert', async () => {
    const client = new FakeStellarClient();
    const a = await client.fundLotEscrow(input);
    const b = await client.fundLotEscrow(input);

    expect(a.txHash).toBe(b.txHash);
    expect(a.txHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.explorerUrl).toBe(`https://stellar.expert/explorer/testnet/tx/${a.txHash}`);
  });

  it('cambia el hash cuando cambia el input o el método', async () => {
    const client = new FakeStellarClient();
    const base = await client.fundLotEscrow(input);
    const distinto = await client.fundLotEscrow({ ...input, amount: 20000 });
    const otroMetodo = await client.completeDeliveryAndSettle({
      codigoLote: 'LOTE-00104',
      buyerWallet: 'GABCDEMO',
      finalAvgWeightKg: 460,
      dtePdfHash: 'a',
      receptionHash: 'b',
      shortfallDeduction: 0,
    });

    expect(base.txHash).not.toBe(distinto.txHash);
    expect(base.txHash).not.toBe(otroMetodo.txHash);
  });

  it('getStellarClient devuelve una implementación de la interfaz', () => {
    expect(typeof getStellarClient().createAndVerifyOrigin).toBe('function');
  });
});
