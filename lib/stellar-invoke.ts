import { Client, type SignTransactionLike } from '@stellar/stellar-sdk/contract';
import {
  STELLAR_CONTRACT_ID,
  STELLAR_NETWORK_PASSPHRASE,
  STELLAR_RPC_URL,
} from '@/lib/stellar-config';
import { mensajeErrorContrato, type ArgsContrato, type MetodoContrato } from '@/lib/stellar-args';

export type ResultadoInvocacion<T = unknown> = { txHash: string; resultado: T | undefined };

type MetodoDinamico = (args: ArgsContrato) => Promise<{
  signAndSend: () => Promise<{
    sendTransactionResponse?: { hash: string };
    getTransactionResponse?: { txHash?: string };
    result: unknown;
  }>;
}>;

/**
 * Simula, firma y envía una invocación del contrato `trazabilidad`.
 * La firma la provee quien llama: `KeypairSigner` (oráculo, servidor) o Freighter (navegador).
 * Funciona en ambos entornos: solo usa `fetch` contra el RPC de Soroban.
 */
export async function invocarContrato<T = unknown>(opts: {
  metodo: MetodoContrato;
  args: ArgsContrato;
  publicKey: string;
  signTransaction: SignTransactionLike;
  contractId?: string;
}): Promise<ResultadoInvocacion<T>> {
  const contractId = opts.contractId ?? STELLAR_CONTRACT_ID;
  if (!contractId) {
    throw new Error('Falta NEXT_PUBLIC_STELLAR_CONTRACT_ID (contrato no desplegado/configurado)');
  }

  try {
    const client = await Client.from({
      contractId,
      rpcUrl: STELLAR_RPC_URL,
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      publicKey: opts.publicKey,
      signTransaction: opts.signTransaction,
    });

    const metodo = (client as unknown as Record<string, MetodoDinamico>)[opts.metodo];
    if (typeof metodo !== 'function') {
      throw new Error(`El contrato ${contractId} no expone el método ${opts.metodo}`);
    }

    const tx = await metodo.call(client, opts.args);
    const enviada = await tx.signAndSend();

    const txHash = enviada.sendTransactionResponse?.hash ?? enviada.getTransactionResponse?.txHash;
    if (!txHash) throw new Error('La red no devolvió el hash de la transacción');

    // Un hash de transacción no prueba éxito: si la red la rechazó, leer el
    // resultado lanza y NO debemos continuar como si hubiera funcionado.
    let resultado: T | undefined;
    try {
      resultado = enviada.result as T;
    } catch (error) {
      throw new Error(
        'La red no confirmó la transacción como exitosa (revisar el hash en el explorador)',
        { cause: error },
      );
    }
    return { txHash, resultado };
  } catch (error) {
    throw new Error(mensajeErrorContrato(error), { cause: error });
  }
}
