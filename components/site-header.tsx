import Image from 'next/image';
import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="bg-brand border-b-4 border-neutral-950 text-neutral-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Muunar — inicio">
          <Image
            src="/brand/muunar-isotipo-blanco.svg"
            alt=""
            width={565}
            height={560}
            priority
            className="h-10 w-auto"
          />
          <span className="text-2xl font-bold tracking-tight text-white">Muunar</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/mercado"
            className="rounded-md px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-950/10"
          >
            Marketplace
          </Link>
          <Link
            href="/lotes/nuevo"
            className="text-brand rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold hover:bg-neutral-900"
          >
            Registrar lote
          </Link>
        </nav>
      </div>
    </header>
  );
}
