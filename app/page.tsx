import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let dbStatus = 'Supabase no configurado';
  let lotes: number | null = null;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = await createClient();
      const { count, error } = await supabase
        .from('lotes')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      lotes = count ?? 0;
      dbStatus = 'Conectado';
    } catch {
      dbStatus = 'Error de conexión';
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Ideathon Neatech</h1>
      <p className="text-neutral-400">Trazabilidad ganadera EUDR con Stellar y Supabase.</p>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-sm">
        <p>
          Estado DB: <span className="font-mono">{dbStatus}</span>
        </p>
        {lotes !== null && (
          <p>
            Lotes registrados: <span className="font-mono">{lotes}</span>
          </p>
        )}
      </div>
    </main>
  );
}
