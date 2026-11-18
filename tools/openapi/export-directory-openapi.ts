/**
 * Writes docs/api/directory-openapi.json from the Directory gateway
 * controllers (no services started). Run: `pnpm run openapi:directory`.
 * The gateway spec test fails when the committed file drifts.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import {
  buildDirectoryOpenApi,
  serializeDirectoryOpenApi,
} from '../../apps/gateway/src/openapi/directory-openapi';

async function main() {
  const out = resolve(__dirname, '../../docs/api/directory-openapi.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, serializeDirectoryOpenApi(await buildDirectoryOpenApi()));
  // eslint-disable-next-line no-console
  console.log(`Directory OpenAPI written to ${out}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  }
);
