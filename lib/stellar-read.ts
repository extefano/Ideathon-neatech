import { Client } from '@stellar/stellar-sdk/contract';
import {
  STELLAR_CONTRACT_ID,
  STELLAR_NETWORK_PASSPHRASE,
  STELLAR_RPC_URL,
} from '@/lib/stellar-config';

export type LecturaLoteOnChain =
  | { estado: 'existe'; eudrGeoHash: string; estadoContrato: string }
  | { estado: 'no_existe' }
  | { estado: 'error'; detalle: string };

type ClienteLote = {
  get_lote(args: { codigo: string }): Promise<{ result?: unknown } | unknown>;
};

/**
 * Lee el origen registrado on-chain (`get_lote`) sin firmar ni enviar nada.
 * `contratoNoConfigurado` cuando el despliegue corre sin contrato: en ese caso
 * la UI debe decir "no se pudo comprobar", nunca "adulterado".
 */
export async function leerLoteOnChain(
  codigo: string,
  opts?: { contractId?: string; cliente?: ClienteLote },
): Promise<LecturaLoteOnChain> {
  const contractId = opts?.contractId ?? STELLAR_CONTRACT_ID;
  if (!contractId && !opts?.cliente) {
    return { estado: 'error', detalle: 'contrato_no_configurado' };
  }

  try {
    const cliente =
      opts?.cliente ??
      ((await Client.from({
        contractId: contractId as string,
        rpcUrl: STELLAR_RPC_URL,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      })) as unknown as ClienteLote);

    const respuesta = await cliente.get_lote({ codigo });
    const valor = ((respuesta as { result?: unknown })?.result ?? respuesta) as {
      eudr_geo_hash?: unknown;
      estado?: unknown;
    };

    return {
      estado: 'existe',
      eudrGeoHash: String(valor?.eudr_geo_hash ?? ''),
      estadoContrato: String(valor?.estado ?? ''),
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    if (/Error\(Contract,\s*#2\)|LoteInexistente/.test(mensaje)) {
      return { estado: 'no_existe' };
    }
    return { estado: 'error', detalle: mensaje.slice(0, 200) };
  }
}
