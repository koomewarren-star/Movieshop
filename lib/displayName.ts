import type { User } from '@supabase/supabase-js';

/**
 * Display name resolution for a viewer.
 *
 * The navbar used to print the full email address, which puts a viewer's
 * address on screen in a cinema full of people and into every screenshot they
 * share. This resolves the least identifying label that still distinguishes
 * accounts.
 *
 * Order of preference:
 *
 *   1. `user_metadata.display_name` — set at sign-up from the field on the
 *      login form. Available immediately in the session, so the navbar needs no
 *      extra query or database round trip.
 *   2. `profiles.display_name` — set by the database trigger for accounts
 *      created before the sign-up field existed.
 *   3. The local part of the email, e.g. `grace@…` becomes `grace`.
 *   4. A generic label, so the UI never renders an empty badge.
 *
 * Nothing here contacts the network, so it is safe to call during render.
 */

/** Longest label rendered in the navbar before it truncates. */
export const MAX_DISPLAY_NAME = 24;

/**
 * Derives a starting suggestion from an email local part.
 *
 * Used to prefill the sign-up field so most viewers accept it without typing.
 * Strips the dots and separators that many providers append, because
 * `grace.otieno` and `grace-otieno` are the same person's name as far as the
 * label is concerned.
 */
export function suggestDisplayName(email: string): string {
  const local = email.split('@')[0] ?? '';
  const cleaned = local
    .replace(/[._-]+/g, ' ')
    .replace(/\d{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Viewer').slice(0, MAX_DISPLAY_NAME);
}

/** Strips characters that would break out of an attribute or a layout. */
export function sanitiseDisplayName(raw: string): string {
  return raw
    .replace(/[<>&"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DISPLAY_NAME);
}

/**
 * Best available display name for a session user.
 *
 * `profiles` is optional: when a caller has already fetched the profile row it
 * is passed in, and when it has not, only the metadata and email fallbacks are
 * used. That keeps the navbar free of a database read.
 */
export function resolveDisplayName(
  user: User | null,
  profileDisplayName?: string | null,
): string {
  if (!user) return 'Guest';

  const fromMetadata = user.user_metadata?.display_name;
  if (typeof fromMetadata === 'string') {
    const cleaned = sanitiseDisplayName(fromMetadata);
    if (cleaned) return cleaned;
  }

  if (typeof profileDisplayName === 'string') {
    const cleaned = sanitiseDisplayName(profileDisplayName);
    if (cleaned) return cleaned;
  }

  if (typeof user.email === 'string' && user.email.includes('@')) {
    const suggestion = sanitiseDisplayName(suggestDisplayName(user.email));
    if (suggestion) return suggestion;
  }

  return 'Viewer';
}

/** One or two letters for the avatar badge. */
export function displayNameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}