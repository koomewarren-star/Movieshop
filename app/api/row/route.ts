import { NextResponse } from 'next/server';
import { getRowPage } from '@/lib/tmdb';
import { MAX_PAGE, getRowDef } from '@/lib/rows';

export const dynamic = 'force-dynamic';

/**
 * Serves one page of a discovery row.
 *
 * This is what keeps the catalogue deep without making the home document heavy.
 * The client asks for page N only once the viewer has scrolled that far, so the
 * initial payload stays small while each row can serve up to MAX_PAGE pages.
 *
 * Without this route every row silently caps at its first 20 items, which looks
 * like the catalogue shrank even though the row definitions are unchanged.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const row = params.get('row')?.trim() ?? '';
  const page = Number(params.get('page'));

  if (!getRowDef(row)) {
    return NextResponse.json({ items: [], hasMore: false }, { status: 400 });
  }
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    return NextResponse.json({ items: [], hasMore: false }, { status: 400 });
  }

  const items = await getRowPage(row, page);

  return NextResponse.json(
    { items, hasMore: items.length > 0 },
    {
      headers: {
        // Rows change slowly; a short shared cache absorbs repeat scrolling that
        // would otherwise re-hit TMDB for the same page.
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
      },
    },
  );
}