import { NextResponse } from 'next/server';
import { getDetails } from '@/lib/tmdb';
import type { MediaKind } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Serves cast, genres, runtime and season count for the details modal. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = Number(params.get('id'));
  const kind = params.get('kind');

  if (!Number.isInteger(id) || id <= 0 || (kind !== 'movie' && kind !== 'tv')) {
    return NextResponse.json({ details: null }, { status: 400 });
  }

  const details = await getDetails(kind as MediaKind, id);
  return NextResponse.json(
    { details },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' } },
  );
}
