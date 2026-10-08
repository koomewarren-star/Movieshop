import type { ReactNode } from 'react';
import Link from 'next/link';
import { PlayCircle } from 'lucide-react';

/**
 * Shared chrome for the auth screen.
 *
 * Kept separate so `/login` does not inherit the storefront Navbar: that
 * navbar is a client component wired to the subscription context, and pulling
 * it in here would mount the whole browsing shell around a two-field form.
 */
export default function AuthCard({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-obsidian px-4 py-10">
      <div className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-[radial-gradient(45rem_22rem_at_50%_0%,rgba(220,38,38,0.22),transparent_70%)]" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="group mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-crimson-sheen shadow-glow transition-transform duration-300 group-hover:scale-105">
            <PlayCircle className="h-6 w-6 text-white" strokeWidth={2.4} />
            <span className="absolute h-10 w-10 rounded-xl ring-1 ring-inset ring-white/25" />
          </span>
          <span className="text-2xl font-black uppercase tracking-tight text-white">
            Movie<span className="text-crimson-bright">Shop</span>
          </span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-charcoal/60 p-6 shadow-glow-lg backdrop-blur-xl sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}