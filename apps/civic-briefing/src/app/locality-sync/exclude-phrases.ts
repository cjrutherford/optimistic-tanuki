import notable from './notable-places.json';
import { US_STATES } from './us-states';

/** A place by name and state code. */
export interface NamedPlace {
  name: string;
  state: string;
}

/** The most populous US incorporated places (Census Bureau estimates, see tools/civic/notable-places.mjs). */
export const NOTABLE_PLACES: readonly NamedPlace[] = (
  notable.places as [string, string, number][]
).map(([name, state]) => ({ name, state }));

/** "Nashville, GA" and "Nashville, Georgia" as "Nashville"; social's seeded names carry the state. */
export function baseName(name: string): string {
  const comma = name.lastIndexOf(',');
  if (comma < 0) return name.trim();
  const tail = name
    .slice(comma + 1)
    .trim()
    .toLowerCase();
  const isState = US_STATES.some(
    (state) =>
      state.code.toLowerCase() === tail ||
      state.name.toLowerCase() === tail ||
      state.ap?.toLowerCase() === tail
  );
  return isState ? name.slice(0, comma).trim() : name.trim();
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bsaint\b/gu, 'st')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

/**
 * Phrases that name a different place sharing a town's name, for each
 * namesake in another state: `Name, Full State`, `Name, AP abbr.` (when AP
 * abbreviates the state) and `Name, ST`. Empty when the name is unique among
 * `others`. The town's own state never produces a phrase.
 */
export function deriveExcludePhrases(
  name: string,
  stateCode: string,
  others: readonly NamedPlace[]
): string[] {
  const base = baseName(name);
  const key = normalize(base);
  if (!key) return [];
  const states = new Set<string>();
  for (const other of others) {
    if (other.state !== stateCode && normalize(baseName(other.name)) === key)
      states.add(other.state);
  }
  const phrases = new Set<string>();
  for (const state of US_STATES) {
    if (!states.has(state.code)) continue;
    phrases.add(`${base}, ${state.name}`);
    if (state.ap) phrases.add(`${base}, ${state.ap}`);
    phrases.add(`${base}, ${state.code}`);
  }
  return [...phrases];
}
