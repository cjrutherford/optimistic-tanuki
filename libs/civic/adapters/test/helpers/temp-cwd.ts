import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Adapters cache downloads and OCR text under ./data; keep that out of the
// repository by running each test file in a directory of its own.
const originalCwd = process.cwd();
const workingDirectory = mkdtempSync(join(tmpdir(), 'civic-adapters-'));
process.chdir(workingDirectory);

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(workingDirectory, { recursive: true, force: true });
});
