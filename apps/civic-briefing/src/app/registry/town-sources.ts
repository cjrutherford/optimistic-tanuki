import type {
  LocalityConfig,
  LocalityRegistry,
  SourceConfig,
} from '@optimistic-tanuki/civic-core';

/**
 * The enabled sources that serve a town: its own, those of the places inside
 * it, and its county's (discovery adopts a county site's feeds for the town).
 * State and region sources are left out, since every town shares them and
 * they say nothing about whether this town has been sourced.
 */
export function townSources(
  registry: Pick<LocalityRegistry, 'ancestors' | 'descendants'>,
  town: LocalityConfig
): SourceConfig[] {
  return [
    town,
    ...registry.descendants(town.slug),
    ...registry.ancestors(town.slug).filter((place) => place.kind === 'county'),
  ]
    .flatMap((place) => place.sources ?? [])
    .filter((source) => source.enabled !== false);
}
