import { sha256Hex } from '@/lib/crypto';

export type StellarTx = { txHash: string; explorerUrl: string };

export type CreateOriginInput = {
  codigoLote: string;
  producerWallet: string;
  renspaDocHash: string;
  rfidListHash: string;
  eudrGeoHash: string;
  headCount: number;
  initialAvgWeightKg: number;
  targetWeightKg: number;
  financingAmount: number;
  tokenSacAddress: string;
};

export type FundLotInput = {
  codigoLote: string;
  buyerWallet: string;
  amount: number;
};

export type VerifySanitaryInput = {
  codigoLote: string;
  vetWallet: string;
  midtermAvgWeightKg: number;
  adpvGramsPerDay: number;
  vaccinationActaHash: string;
  midtermRfidWeightsHash: string;
};

export type CompleteDeliveryInput = {
  codigoLote: string;
  buyerWallet: string;
  finalAvgWeightKg: number;
  dtePdfHash: string;
  receptionHash: string;
  shortfallDeduction: number;
};

export interface StellarTraceabilityClient {
  createAndVerifyOrigin(input: CreateOriginInput): Promise<StellarTx>;
  fundLotEscrow(input: FundLotInput): Promise<StellarTx>;
  verifySanitaryMilestone(input: VerifySanitaryInput): Promise<StellarTx>;
  completeDeliveryAndSettle(input: CompleteDeliveryInput): Promise<StellarTx>;
}

/**
 * Modo demo: genera tx hashes SHA-256 deterministas por método+input y links a
 * Stellar Expert (testnet). NO son transacciones reales. Reemplazar por el
 * cliente real (stellar-sdk + contrato Soroban desplegado) cuando esté listo;
 * la interfaz ya coincide con los métodos del contrato (`lib/stellar`).
 */
export class FakeStellarClient implements StellarTraceabilityClient {
  constructor(private readonly salt: string = 'demo-2026') {}

  async createAndVerifyOrigin(input: CreateOriginInput): Promise<StellarTx> {
    return this.tx('create_and_verify_origin', input);
  }

  async fundLotEscrow(input: FundLotInput): Promise<StellarTx> {
    return this.tx('fund_lot_escrow', input);
  }

  async verifySanitaryMilestone(input: VerifySanitaryInput): Promise<StellarTx> {
    return this.tx('verify_sanitary_milestone', input);
  }

  async completeDeliveryAndSettle(input: CompleteDeliveryInput): Promise<StellarTx> {
    return this.tx('complete_delivery_and_settle', input);
  }

  private tx(method: string, input: unknown): StellarTx {
    const txHash = sha256Hex(`fake-soroban:${this.salt}:${method}:${JSON.stringify(input)}`);
    return { txHash, explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}` };
  }
}

export const TOKEN_SAC_TESTNET_USDC = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

export function getStellarClient(): StellarTraceabilityClient {
  return new FakeStellarClient();
}
