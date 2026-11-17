/**
 * No receipt currently proves a committed, current Directory projection across connection
 * loss or database restore. Keep the ACK boundary closed until an independently bound
 * authority and recovery protocol establish those properties under an external writer fence.
 * In particular, receipt authentication alone cannot authorize a register update.
 */
export function acknowledgeDirectoryRegister(): never {
  throw new Error('Directory register acknowledgement is unavailable');
}
