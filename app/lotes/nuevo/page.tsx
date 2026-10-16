import Link from 'next/link';
import { FormularioLote } from './formulario';

export const dynamic = 'force-dynamic';

export default function NuevoLotePage() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
        ← Volver
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Registrar lote — Paso 1</h1>
      <p className="mt-2 max-w-3xl text-neutral-400">
        Origen, documentación, trazabilidad RFID y condiciones comerciales. Al enviar se consulta
        Global Forest Watch contra el polígono (EUDR, corte 31/12/2020) y, sin desmonte, se registra
        el Sello 1 con los hashes SHA-256.
      </p>
      <FormularioLote />
    </main>
  );
}
