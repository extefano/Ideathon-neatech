import Link from 'next/link';
import { BannerRolRequerido, CredencialSesion } from '@/components/auth-guard';
import { getCurrentUser } from '@/lib/auth';
import { FormularioLote } from './formulario';

export const dynamic = 'force-dynamic';

export default async function NuevoLotePage() {
  const user = await getCurrentUser();
  const esProductor = user?.rol === 'PRODUCTOR';

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <Link href="/" className="text-sm text-neutral-400 hover:text-yellow-400">
          ← Volver
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Registrar lote — Paso 1</h1>
        <p className="mt-2 max-w-3xl text-neutral-400">
          Origen, documentación, trazabilidad RFID y condiciones comerciales. Al enviar se consulta
          Global Forest Watch contra el polígono (EUDR, corte 31/12/2020) y, sin desmonte, se
          registra el Sello 1 con los hashes SHA-256.
        </p>
      </div>

      {!esProductor ? (
        <BannerRolRequerido
          rolRequerido="PRODUCTOR"
          titulo="El alta de lotes requiere cuenta de Productor"
          descripcion="Para cargar origen, documentación, trazabilidad RFID y solicitar financiación debés identificarte como Productor en la plataforma."
          userActual={user}
        />
      ) : (
        <>
          <CredencialSesion user={user} />
          <FormularioLote user={user} />
        </>
      )}
    </main>
  );
}
