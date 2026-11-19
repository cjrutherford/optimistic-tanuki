import type { LocalityRegistry } from '@optimistic-tanuki/civic-core';

/**
 * The one place civic-briefing gets its locality registry from. The registry is
 * built from the database (social sync → render → load, D25/D29), never from a
 * mounted YAML directory. Nest injects the concrete implementation under this
 * abstract class as its token.
 */
export abstract class LocalityRegistrySource {
  /** The most recently loaded registry; an empty registry until the first load succeeds. */
  abstract current(): LocalityRegistry;

  /**
   * Re-renders the YAML from the database and reloads. By default it first
   * re-syncs from social; pass `{ sync: false }` when only civic-briefing's own
   * rows changed (e.g. after adopting a source). Concurrent calls share one refresh.
   */
  abstract refresh(options?: { sync?: boolean }): Promise<LocalityRegistry>;
}
