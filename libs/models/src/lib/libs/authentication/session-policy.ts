/** OT/TS sessions expire through authoritative database inactivity, not total age. */
export const SESSION_IDLE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export function isRollingSessionApp(
  appId: unknown
): appId is 'client-interface' | 'local-hub' {
  return appId === 'client-interface' || appId === 'local-hub';
}
