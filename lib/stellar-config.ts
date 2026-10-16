// Configuración pública de Stellar/Soroban. Segura para cliente y servidor:
// solo contiene valores NEXT_PUBLIC_* (nada secreto).

export const STELLAR_RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';

export const STELLAR_NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';

export const STELLAR_CONTRACT_ID = process.env.NEXT_PUBLIC_STELLAR_CONTRACT_ID ?? '';

const EXPERT_RED = STELLAR_NETWORK_PASSPHRASE.includes('Public') ? 'public' : 'testnet';

export const STELLAR_HORIZON_URL =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

export const USDC_ASSET_CODE = 'USDC';
export const USDC_ASSET_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export const explorerTxUrl = (txHash: string) =>
  `https://stellar.expert/explorer/${EXPERT_RED}/tx/${txHash}`;

export const explorerContractUrl = (contractId: string) =>
  `https://stellar.expert/explorer/${EXPERT_RED}/contract/${contractId}`;

export const explorerCuentaUrl = (address: string) =>
  `https://stellar.expert/explorer/${EXPERT_RED}/account/${address}`;
