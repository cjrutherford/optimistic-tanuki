import { DirectoryQueue, Job } from './queue';

// S1's only processor is an infrastructure check. Acquisition is deliberately absent.
export async function processJob(job: Job): Promise<void> {
  if (job.type !== 's1.check') throw new Error('Unsupported job type');
}
export async function consumeOnce(queue: DirectoryQueue): Promise<boolean> {
  const job = await queue.claim(30000);
  if (!job) return false;
  try {
    await processJob(job);
    await queue.complete(job);
  } catch (error) {
    await queue.fail(
      job,
      error instanceof Error ? error.message : 'Processor failed'
    );
  }
  return true;
}
export async function runWorker(
  queue: DirectoryQueue,
  signal: AbortSignal
): Promise<void> {
  while (!signal.aborted) {
    // Connection loss can interrupt any transition; leases recover uncertain claims.
    try {
      if (await consumeOnce(queue)) continue;
    } catch {
      /* Retry after reconnect. */
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  }
}
