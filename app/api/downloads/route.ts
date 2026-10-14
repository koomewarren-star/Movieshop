import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listDownloads, removeDownload, saveDownload } from '@/lib/serverDownloads';
import { loadCatalog, mediaFilePath, mediaFileSize } from '@/lib/serverMedia';

/**
 * The viewer's saved-download library, as JSON.
 *
 *   GET    -> everything this viewer has saved
 *   POST   -> save a title   { key, tmdbId, kind, title, season, episode, poster }
 *   DELETE -> remove a title ?key=movie:969681
 *
 * All three require a session, and all three are scoped to the caller by Row
 * Level Security rather than by anything in this file.
 */
export const dynamic = 'force-dynamic';

async function session() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return supabase;
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await session();
  if (!supabase) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  return NextResponse.json({ downloads: await listDownloads(supabase) }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function POST(request: Request) {
  const supabase = await session();
  if (!supabase) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const key = typeof body.key === 'string' ? body.key : '';

  if (!key) {
    return NextResponse.json({ error: 'key is required.' }, { status: 400 });
  }

  /*
    The catalogue is the authority on what exists, and the filename is resolved
    here rather than accepted from the client. Accepting a client-supplied
    filename would mean the browser chooses which file gets attached to a
    library row, which is exactly the kind of thing that turns into a path
    traversal later.
   */
  const catalog = await loadCatalog();
  const entry = catalog[key];
  if (!entry) {
    return NextResponse.json({ error: 'That title has no downloadable file.' }, { status: 404 });
  }

  const filePath = await mediaFilePath(entry.fileName);
  if (!filePath) {
    return NextResponse.json({ error: 'That file is not on the server.' }, { status: 404 });
  }

  const result = await saveDownload(supabase, {
    key,
    tmdbId: Number(body.tmdbId),
    kind: body.kind === 'tv' ? 'tv' : 'movie',
    title: typeof body.title === 'string' ? body.title : key,
    season: typeof body.season === 'number' ? body.season : undefined,
    episode: typeof body.episode === 'number' ? body.episode : undefined,
    poster: typeof body.poster === 'string' ? body.poster : null,
    fileName: entry.fileName,
    sizeBytes: await mediaFileSize(filePath).catch(() => 0),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Could not save.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await session();
  if (!supabase) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const key = new URL(request.url).searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key is required.' }, { status: 400 });

  const result = await removeDownload(supabase, key);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Could not remove.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}