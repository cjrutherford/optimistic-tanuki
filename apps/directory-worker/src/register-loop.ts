type Result = 'more' | 'complete';
type Options = {
  signal: AbortSignal;
  bootstrap: () => Promise<Result>;
  sweep: () => Promise<Result>;
  retryMs?: number;
  sweepIntervalMs?: number;
  pause?: (ms: number) => Promise<void>;
  onError?: () => void;
};

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

/** The caller supplies a pinned authority and separately owns service startup and fencing. */
export async function runRegisterLoop(options: Options): Promise<void> {
  const retryMs = options.retryMs ?? 5000,
    sweepIntervalMs = options.sweepIntervalMs ?? 60000;
  if (
    !Number.isSafeInteger(retryMs) ||
    retryMs < 1 ||
    retryMs > 3600000 ||
    !Number.isSafeInteger(sweepIntervalMs) ||
    sweepIntervalMs < 1 ||
    sweepIntervalMs > 3600000
  )
    throw Error('Invalid register loop interval');
  const pause = options.pause ?? ((ms: number) => delay(ms, options.signal));
  let bootstrapped = false;
  while (!options.signal.aborted) {
    try {
      const result = await (bootstrapped
        ? options.sweep()
        : options.bootstrap());
      if (result !== 'more' && result !== 'complete')
        throw Error('Invalid register page result');
      if (!bootstrapped) {
        if (result === 'complete') bootstrapped = true;
        continue;
      }
      await pause(result === 'complete' ? sweepIntervalMs : 0);
    } catch {
      options.onError?.();
      if (!options.signal.aborted) await pause(retryMs);
    }
  }
}
