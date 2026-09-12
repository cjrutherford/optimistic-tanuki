/**
 * Business seed entrypoint.
 * Keeps the expected business-site seed filename while reusing the existing script implementation.
 */

import { bootstrap } from './seed-trainer.mjs';

bootstrap().catch((err) => {
  console.error('Business seed failed:', err);
  process.exitCode = 1;
});
