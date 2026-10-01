import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dropCreatedSchemas } from './postgres.js';

// Runs that publish without an output root write under ./data, as do the
// default publication lock and blob paths; keep those out of the repository.
const originalCwd = process.cwd();
const workingDirectory = mkdtempSync(join(tmpdir(), 'civic-core-db-'));
process.chdir(workingDirectory);

afterAll(async () => {
  await dropCreatedSchemas();
  process.chdir(originalCwd);
  rmSync(workingDirectory, { recursive: true, force: true });
});
