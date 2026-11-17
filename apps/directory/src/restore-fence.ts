/**
 * The v1 receipt identity can recur after an independent restore. Do not start
 * either process until durable epochs, v2 identity and recovery are implemented.
 */
export function assertRestoreProtocolAvailable(): void {
  throw new Error('Directory restore fencing is not implemented; v1 startup is disabled');
}
