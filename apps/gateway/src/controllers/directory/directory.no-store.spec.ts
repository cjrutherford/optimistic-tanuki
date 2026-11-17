import 'reflect-metadata';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HEADERS_METADATA, PATH_METADATA } from '@nestjs/common/constants';

interface HeaderMetadata {
  name: string;
  value: string;
}

/** Every exported controller class in this directory, discovered from disk so a new controller is covered automatically. */
function controllers(): Array<{ name: string; type: any }> {
  const found: Array<{ name: string; type: any }> = [];
  for (const file of readdirSync(__dirname).filter((f) =>
    /\.controller\.ts$/.test(f)
  )) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(join(__dirname, file));
    for (const [name, value] of Object.entries(mod))
      if (
        typeof value === 'function' &&
        Reflect.getMetadata(PATH_METADATA, value) !== undefined
      )
        found.push({ name, type: value });
  }
  return found;
}

function handlers(type: any): string[] {
  return Object.getOwnPropertyNames(type.prototype).filter(
    (name) =>
      name !== 'constructor' &&
      typeof type.prototype[name] === 'function' &&
      Reflect.getMetadata(PATH_METADATA, type.prototype[name]) !== undefined
  );
}

describe('directory controllers never allow caching', () => {
  const all = controllers();

  it('discovers every directory controller', () => {
    expect(all.map((c) => c.name).sort()).toEqual(
      expect.arrayContaining([
        'DirectoryAddressReviewController',
        'DirectoryBusinessIdentityReviewController',
        'DirectoryBusinessLinkController',
        'DirectoryBusinessLinkQueueController',
        'DirectoryController',
        'DirectoryListingSuppressionController',
        'DirectoryRightsCasesController',
        'DirectoryWithdrawalsController',
        'DirectoryTaxonomyController',
        'DirectoryListingReportController',
        'DirectoryListingReportReviewController',
      ])
    );
  });

  const table = all.flatMap(({ name, type }) =>
    handlers(type).map((handler) => [name, handler, type] as const)
  );

  it('has a non-trivial handler table', () => {
    expect(table.length).toBeGreaterThanOrEqual(18);
  });

  it.each(table)(
    '%s.%s carries Cache-Control: no-store',
    (_name, handler, type) => {
      const headers: HeaderMetadata[] =
        Reflect.getMetadata(HEADERS_METADATA, type.prototype[handler]) ?? [];
      const cacheControl = headers.filter(
        (h) => h.name.toLowerCase() === 'cache-control'
      );
      expect(cacheControl).toHaveLength(1);
      expect(cacheControl[0].value).toBe('no-store');
    }
  );
});
