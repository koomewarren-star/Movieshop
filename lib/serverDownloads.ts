import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SaveDescriptor, SavedDownload } from './downloadTypes';

/**
 * Server-side saved-download library.
 *
 * The file bytes already live on disk in `storage/media/`. What is stored in
 * Postgres is only the association between a viewer and a title, which is why
 * this works for a 291 MB film as readily as for a 2 MB clip: saving is one row
 * insert, not a copy.
 *
 * Authorization is entirely Row Level Security. Every statement here runs with
 * the viewer's own JWT and the policies in `supabase/schema.sql` decide what
 * that viewer may read or write. There is deliberately no `if (user.id === ...)`
 * check in this file: a role comparison here would be a second, weaker
 * authorization path, and the kind of thing that survives a refactor nobody
 * re-reasoned about.
 *
 * Until the SQL is applied the policies deny everything and the library reads as
 * empty, which is the correct fail-closed behaviour.
 */

type Db = any;

/** Everything this viewer has saved, newest first. */
export async function listDownloads(supabase: SupabaseClient<Db>): Promise<SavedDownload[]> {
  const { data, error } = await supabase
    .from('saved_downloads')
    .select('id, key, tmdb_id, kind, title, season, episode, poster, file_name, size_bytes, created_at')
    .order('created_at', { ascending: false });

  if (error || !Array.isArray(data)) return [];
  return data as SavedDownload[];
}

/** Saves a title. Idempotent: saving twice is a no-op, not an error. */
export async function saveDownload(
  supabase: SupabaseClient<Db>,
  input: SaveDescriptor,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('saved_downloads').upsert(
    {
      key: input.key,
      tmdb_id: input.tmdbId,
      kind: input.kind,
      title: input.title,
      season: input.season ?? null,
      episode: input.episode ?? null,
      poster: input.poster ?? null,
      file_name: input.fileName,
      size_bytes: input.sizeBytes ?? null,
    },
    { onConflict: 'user_id,key', ignoreDuplicates: true },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Removes one saved title. The RLS policy scopes the delete to the owner. */
export async function removeDownload(
  supabase: SupabaseClient<Db>,
  key: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('saved_downloads').delete().eq('key', key);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type { SaveDescriptor, SavedDownload };