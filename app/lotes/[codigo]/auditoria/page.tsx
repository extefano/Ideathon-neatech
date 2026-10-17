import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { BannerRolRequerido, CredencialSesion } from '@/components/auth-guard';
import { Aviso } from '@/components/ui/aviso';
import { Pasos } from '@/components/ui/pasos';
import { Tarjeta } from '@/components/ui/tarjeta';
import { getCurrentUser } from '@/lib/auth';
import { calcularDesembolsos } from '@/lib/escrow';
import { getLoteCompleto } from '@/lib/queries';
import { FormAuditoria } from './form-auditoria';

export const dynamic = 'force-dynamic';

const PASOS_AUDITORIA = [
  { titulo: 'Acta SIGSA', descripcion: 'Vacunación' },
  { titulo: 'Pesada Mes 4', descripcion: 'CSV de balanza' },
  { titulo: 'Resultado y firma', descripcion: 'ADPV y Sello 2' },
];

export default async function AuditoriaPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const user = await getCurrentUser();
  const data = await getLoteCompleto(codigo);
  const lote = data?.lote;

  if (!lote) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p>Lote no encontrado.</p>
      </main>
    );
  }

  const volver = (
    <Link
      href={`/lotes/${codigo}`}
      className="focus-visible:ring-foco hover:text-brand-fuerte text-texto-suave inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Volver a la ficha
    </Link>
  );

  if (lote.estado_publicacion !== 'FINANCIADO_EN_ENGORDE' || lote.seal_2_sanitary) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        {volver}
        <div className="mt-6">
          <Aviso variante="alerta" titulo="Esta auditoría no está disponible">
            El lote debe estar financiado y sin Sello 2. Este paso es exclusivo del Veterinario
            acreditado.
          </Aviso>
        </div>
      </main>
    );
  }

  const esVeterinario = user?.rol === 'VETERINARIO';

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      {volver}
      <div>
        <h1 className="text-3xl font-bold">Auditoría sanitaria — Mes 4</h1>
        <p className="text-texto-suave mt-2 text-sm">
          {lote.codigo_lote} · {lote.titulo} · peso inicial {lote.peso_promedio_kg} kg
        </p>
      </div>

      <Pasos pasos={PASOS_AUDITORIA} actual={0} />

      {!esVeterinario ? (
        <BannerRolRequerido
          rolRequerido="VETERINARIO"
          titulo="Auditoría exclusiva para Veterinarios acreditados"
          descripcion="El protocolo del Mes 4 (acta SIGSA, pesada RFID y validación del ADPV) lo ejecuta un Veterinario matriculado. El Productor y el Comprador no pueden cargar este paso."
          userActual={user}
          redirectTo={`/lotes/${codigo}/auditoria`}
        />
      ) : (
        <Tarjeta
          titulo="Completá la secuencia"
          descripcion="Al firmar se calcula el ADPV contra el rango biológico INTA (0,5 a 1,3 kg/día) y se libera el 30 % del pago."
        >
          <div className="space-y-4">
            <CredencialSesion user={user} />
            <FormAuditoria
              codigo={codigo}
              user={user}
              productorWallet={lote.productor_wallet ?? undefined}
              montoHito2Usdc={calcularDesembolsos(Number(lote.monto_total_financiacion ?? 0)).hito2}
            />
          </div>
        </Tarjeta>
      )}
    </main>
  );
}
