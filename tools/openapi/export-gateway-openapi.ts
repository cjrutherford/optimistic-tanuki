/**
 * O15a: exports the gateway OpenAPI document to `dist/openapi.json` for
 * orval codegen. Boots the real AppModule in-process (no listen) so the
 * document matches exactly what `/api-docs` serves.
 *
 * Run: `pnpm run get-openapi` (writes `dist/openapi.json`).
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/gateway/src/app/app.module';
import { buildSwaggerDocument } from '../../apps/gateway/src/swagger-document';

async function main() {
  // Same guards as production boot, with CI-safe fallbacks: the document
  // build needs no secrets, only a configured environment shape. The app
  // registry path mirrors the dev-compose mount (default-registry.json).
  process.env.OAUTH_STATE_SECRET ??= 'openapi-export-placeholder';
  // The document build only needs DI wiring, not a live OAuth state store.
  // Default to the process-local store so the export works without Redis
  // (CI runners and fresh checkouts have no REDIS_HOST).
  process.env.NODE_ENV ??= 'test';
  process.env.OAUTH_STATE_STORE ??= 'local';
  process.env.APP_REGISTRY_PATH ??= resolve(
    __dirname,
    '../../libs/app-registry/src/lib/default-registry.json'
  );
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  app.setGlobalPrefix('api');
  const document = buildSwaggerDocument(app);
  const outPath =
    process.env.OPENAPI_OUT ?? resolve(__dirname, '../../dist/openapi.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  // eslint-disable-next-line no-console
  console.log(`OpenAPI document written to ${outPath}`);
  await app.close();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
