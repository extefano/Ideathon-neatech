import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY (server-only)');
  }

  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function subirArchivo(opts: {
  bucket: string;
  path: string;
  file: Buffer;
  contentType: string;
}): Promise<string> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(opts.bucket)
    .upload(opts.path, opts.file, { contentType: opts.contentType, upsert: true });

  if (error) {
    throw new Error(`Error subiendo a Storage (${opts.bucket}/${opts.path}): ${error.message}`);
  }

  return opts.path;
}

export function sanitizarNombre(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-');
}
