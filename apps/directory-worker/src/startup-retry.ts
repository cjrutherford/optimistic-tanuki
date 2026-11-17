type Options = {
  signal: AbortSignal;
  timeoutMs?: number;
  initialMs?: number;
  maxMs?: number;
  now?: () => number;
  pause?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
};

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

/**
 * Retries a startup step while Directory (database authority, Social) is not
 * ready, with exponential backoff capped at maxMs. Gives up with the last error
 * once timeoutMs has elapsed, so a genuinely broken deployment still exits.
 */
export async function retryUntilReady<T>(attempt: () => Promise<T>, options: Options): Promise<T> {
  const now = options.now ?? Date.now;
  const pause = options.pause ?? ((ms: number) => delay(ms, options.signal));
  const log = options.log ?? ((m: string) => console.error(m));
  const timeoutMs = options.timeoutMs ?? 600_000, maxMs = options.maxMs ?? 30_000;
  let wait = options.initialMs ?? 1000;
  const deadline = now() + timeoutMs;
  for (let n = 1; ; n++) {
    try { return await attempt(); } catch (error) {
      if (options.signal.aborted || now() + wait > deadline) throw error;
      log(`Directory not ready; retrying startup in ${wait}ms (attempt ${n})`);
      await pause(wait);
      wait = Math.min(wait * 2, maxMs);
    }
  }
}
