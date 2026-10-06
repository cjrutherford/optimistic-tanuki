import { Logger } from '@nestjs/common';
import {
  loadLocalityRegistry,
  type LocalityConfig,
} from '@optimistic-tanuki/civic-core';

/** The locality graph, read from CIVIC_LOCALITIES_DIR at startup: which towns are editions, and each one's officials. */
export const LOCALITIES = Symbol('LOCALITIES');

export interface Localities {
  find(slug: string): LocalityConfig | undefined;
  get(slug: string): LocalityConfig;
  /** The towns the pipeline publishes an edition for: what density is measured against. */
  editions(): string[];
}

/**
 * The localities in a directory. With no directory the provider is empty:
 * no town is known, so every submission is refused as being for a town not
 * covered, and the service still starts and answers.
 */
export function buildLocalities(
  directory: string | null,
  logger: Pick<Logger, 'warn'> = new Logger('Localities')
): Localities {
  if (!directory) {
    logger.warn(
      'CIVIC_LOCALITIES_DIR is not set: no localities are loaded, so no town can be contributed to.'
    );
    return {
      find: () => undefined,
      get: (slug) => {
        throw new Error(`unknown locality: ${slug}`);
      },
      editions: () => [],
    };
  }
  const registry = loadLocalityRegistry(directory);
  return {
    find: (slug) => registry.all().find((locality) => locality.slug === slug),
    get: (slug) => registry.get(slug),
    editions: () => registry.editions().map((locality) => locality.slug),
  };
}
