import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import {
  EnvelopeEncryptionService,
  VerifiedMediaSpoolService,
} from '@optimistic-tanuki/storage';

async function main(): Promise<void> {
  const [sourcePath, spoolRoot] = process.argv.slice(2);
  if (!sourcePath || !spoolRoot)
    throw new Error('source and spool paths are required');

  const spool = new VerifiedMediaSpoolService(
    new EnvelopeEncryptionService(process.env),
    {
      spoolRoot,
      maxPlaintextBytes: 128 * 1024 * 1024,
      maxConcurrent: 1,
      spoolBudgetBytes: 128 * 1024 * 1024,
    }
  );
  const rssBefore = process.memoryUsage().rss;
  let rssAfterSpool = rssBefore;
  let rssAfterDrain = rssBefore;
  let peakRss = rssBefore;
  const startedAt = performance.now();
  const sample = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 2);
  sample.unref();

  const handle = await spool.create(() => createReadStream(sourcePath), {
    maxPlaintextBytes: 128 * 1024 * 1024,
  });
  rssAfterSpool = process.memoryUsage().rss;
  const spoolBytes = (await stat(handle.path)).size;
  let bytesRead = 0;
  for await (const chunk of handle.createReadStream()) {
    bytesRead += Buffer.byteLength(chunk);
  }
  rssAfterDrain = process.memoryUsage().rss;
  await handle.cleanup();
  const elapsedMs = performance.now() - startedAt;
  clearInterval(sample);
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  let spoolExistsAfterCleanup = true;
  try {
    await stat(handle.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      spoolExistsAfterCleanup = false;
    } else {
      throw error;
    }
  }

  process.stdout.write(
    JSON.stringify({
      bytesRead,
      spoolBytes,
      rssBefore,
      rssAfterSpool,
      rssAfterDrain,
      peakRss,
      rssDelta: Math.max(0, peakRss - rssBefore),
      elapsedMs,
      spoolExistsAfterCleanup,
    })
  );
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`
  );
  process.exitCode = 1;
});
