import { NextResponse } from 'next/server';
import { searchMulti } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

/** Proxies TMDB autocomplete so the API key never ships in the client bundle. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchMulti(query);
  return NextResponse.json(
    { results },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  );
}
