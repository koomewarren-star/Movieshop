import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createMediaStream,
  loadCatalog,
  mediaFilePath,
  mediaFileSize,
  mediaMimeType,
} from './serverMedia';

/**
 * Download a title by its catalogue key.
 *
 * Resolves `movie:969681` to a real filename from the private manifest, so the
 * browser can link to a title without ever being told a filename. Sends the
 * catalogue's friendly title as the download name when one is set.
 *
 * Lives here rather than in the route file because a Next.js route module may
 * only export the HTTP method handlers; anything else fails the build with a
 * confusing `OmitWithTag` constraint error.
 */
export async function handleKeyDownload(request: Request): Promise<Response> {
  let user = null;
  try {
    const supabase = await createClient();
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    return NextResponse.json({ error: 'Service not configured.' }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Sign in to download.' }, { status: 401 });
  }

  const key = new URL(request.url).searchParams.get('key') ?? '';
  if (!key) return NextResponse.json({ error: 'key is required.' }, { status: 400 });

  const catalog = await loadCatalog();
  const entry = catalog[key];
  if (!entry) return NextResponse.json({ error: 'That title has no file.' }, { status: 404 });

  const filePath = await mediaFilePath(entry.fileName);
  if (!filePath) return NextResponse.json({ error: 'That file is not on the server.' }, { status: 404 });

  let size: number;
  try {
    size = await mediaFileSize(filePath);
  } catch {
    return NextResponse.json({ error: 'That file is not on the server.' }, { status: 404 });
  }

  const suggested = (entry.title ?? entry.fileName).replace(/[^\w\-. ]+/g, '_').trim();
  const dot = entry.fileName.lastIndexOf('.');
  const ext = dot > -1 ? entry.fileName.slice(dot) : '.mp4';

  const stream = await createMediaStream(filePath, 0, size - 1);
  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': mediaMimeType(entry.fileName),
      'Content-Length': String(size),
      'Content-Disposition': `attachment; filename="${suggested}${ext}"`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}