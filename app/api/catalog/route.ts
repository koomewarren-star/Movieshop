import { NextResponse } from 'next/server';
import { loadCatalog } from '@/lib/serverMedia';

export const dynamic = 'force-dynamic';

/**
 * Which titles are downloadable.
 *
 * Public, and deliberately so: a Save button has to decide whether to render
 * itself before anyone signs in, and knowing a film has a download is not
 * sensitive — the titles are public via TMDB.
 *
 * What it deliberately does NOT return is the filename. The catalogue maps
 * keys to real files, and publishing that would let anyone enumerate the
 * library and request files directly. Filenames are resolved server-side.
 */
export async function GET() {
  const catalog = await loadCatalog();
  return NextResponse.json(
    { keys: Object.keys(catalog) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}