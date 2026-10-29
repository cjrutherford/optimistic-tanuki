const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
/** Trusted input renews cookie transport for socket-only use. No timer or telemetry. */
export function watchAuthenticatedActivity(
  authenticated: () => boolean,
  refresh: () => Promise<unknown>,
  target: Pick<
    EventTarget,
    'addEventListener' | 'removeEventListener'
  > = document,
  now: () => number = () => performance.now()
): () => void {
  let last = now();
  let stopped = false;
  const input: EventListener = (event) => {
    if (
      stopped ||
      !event.isTrusted ||
      !authenticated() ||
      now() - last < REFRESH_INTERVAL_MS
    )
      return;
    last = now();
    void refresh().catch(() => undefined);
  };
  target.addEventListener('pointerdown', input, { passive: true });
  target.addEventListener('keydown', input, { passive: true });
  return () => {
    stopped = true;
    target.removeEventListener('pointerdown', input);
    target.removeEventListener('keydown', input);
  };
}
