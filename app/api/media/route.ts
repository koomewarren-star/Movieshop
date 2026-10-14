import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createMediaStream,
  loadCatalog,
  mediaFilePath,
  mediaFileSize,
  mediaMimeType,
  parseRange,
} from '@/lib/serverMedia';

/**
 * Auth-gated media streaming.
 *
 * Files are read from `storage/media/`, which is outside `public/`, so this
 * route is the only way to reach one. Every request is checked against the
 * Supabase session first; an anonymous caller gets 401 and never touches the
 * filesystem.
 *
 * Range requests are supported because playback depends on them: without it a
 * browser cannot seek, and Safari refuses progressive MP4 entirely.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let user = null;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    return NextResponse.json({ error: 'Service not configured.' }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Sign in to access downloads.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const fileName = url.searchParams.get('file') ?? '';
  // `download` asks for an attachment rather than inline playback.
  const asAttachment = url.searchParams.get('download') === '1';

  if (!fileName) {
    return NextResponse.json({ error: 'A file name is required.' }, { status: 400 });
  }

  const filePath = await mediaFilePath(fileName);
  if (!filePath) {
    // 404 rather than 403: an unauthorised viewer should not learn whether a
    // given title exists, and both cases are "nothing here for you".
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  let size: number;
  try {
    size = await mediaFileSize(filePath);
  } catch {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const type = mediaMimeType(fileName);
  const range = parseRange(request.headers.get('range'), size);
  const safeName = fileName.replace(/[^\w.\- ]+/g, '_');

  const baseHeaders: Record<string, string> = {
    'Content-Type': type,
    // Private: this is a viewer's library, not a shared cache.
    'Cache-Control': 'private, no-store',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
  };

  if (asAttachment) {
    baseHeaders['Content-Disposition'] = `attachment; filename="${safeName}"`;
  }

  if (!range) {
    const stream = await createMediaStream(filePath, 0, size - 1);
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 200,
      headers: { ...baseHeaders, 'Content-Length': String(size) },
    });
  }

  const { start, end } = range;
  const stream = await createMediaStream(filePath, start, end);

  return new NextResponse(stream as unknown as ReadableStream, {
    // 206 is what tells the browser this is a partial response; returning 200
    // with a Content-Range confuses some players into buffering the whole file.
    status: 206,
    headers: {
      ...baseHeaders,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
    },
  });
}
