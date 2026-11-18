import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  buildDirectoryOpenApi,
  serializeDirectoryOpenApi,
} from './directory-openapi';

interface Op {
  security?: unknown[];
  'x-public'?: boolean;
  'x-required-permissions'?: string[];
}
type Doc = { paths: Record<string, Record<string, Op>> };

const COMMITTED = resolve(
  __dirname,
  '../../../../docs/api/directory-openapi.json'
);

describe('Directory OpenAPI', () => {
  let doc: Doc;
  beforeAll(async () => {
    doc = (await buildDirectoryOpenApi()) as unknown as Doc;
  }, 60000);

  it('matches the committed docs/api/directory-openapi.json (run `pnpm run openapi:directory` to refresh)', () => {
    expect(serializeDirectoryOpenApi(doc)).toBe(
      readFileSync(COMMITTED, 'utf8')
    );
  });

  it('marks the public evaluation routes as unauthenticated', () => {
    const list =
      doc.paths['/api/directory/towns/{id}/local-evaluation-listings']?.['get'];
    expect(list?.['x-public']).toBe(true);
    expect(list?.security).toEqual([]);
  });

  it('requires bearer auth and a permission on owner routes', () => {
    const op =
      doc.paths['/api/directory/towns/{id}/boundary-decisions']?.['post'];
    expect(op?.security).toEqual([{ bearer: [] }]);
    expect(op?.['x-required-permissions']?.length).toBeGreaterThan(0);
  });
});
