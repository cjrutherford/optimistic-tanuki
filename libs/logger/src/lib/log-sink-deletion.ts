/** Internal per-declared-sink building block. It does not discover identities,
 * establish complete inventory coverage, authorize deletion or complete a global job. */
export interface LogSubjectSelection {
  accountId: string;
  profileIds: readonly string[];
}
export interface LogSinkDescriptor {
  id: string;
  deletionMode: 'account-keyed' | 'operator-managed' | 'shared-unresolved';
}
export interface LogSinkPurgeAdapter {
  purge(selection: LogSubjectSelection): Promise<void>;
  readback(selection: LogSubjectSelection): Promise<number>;
}
export type LogSinkResultCode =
  | 'PURGE_VERIFIED'
  | 'PURGE_UNSUPPORTED'
  | 'OWNERSHIP_UNVERIFIED'
  | 'PURGE_FAILED'
  | 'READBACK_FAILED'
  | 'RECORDS_REMAIN';
export interface LogSinkResult {
  sinkIndex: number;
  code: LogSinkResultCode;
}
export interface LogSinkDeletionResult {
  allDeclaredSinksVerified: boolean;
  inventoryValid: boolean;
  results: LogSinkResult[];
}
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SINK_ID = /^[a-z][a-z0-9_.-]{0,95}$/;

export async function verifyLogSinkDeletion(
  selection: LogSubjectSelection,
  sinks: readonly LogSinkDescriptor[],
  adapters: ReadonlyMap<string, LogSinkPurgeAdapter>
): Promise<LogSinkDeletionResult> {
  if (
    !selection ||
    typeof selection.accountId !== 'string' ||
    !UUID.test(selection.accountId) ||
    !Array.isArray(selection.profileIds) ||
    selection.profileIds.length > 10_000 ||
    selection.profileIds.some((id) => typeof id !== 'string' || !UUID.test(id))
  )
    throw new Error('INVALID_LOG_SUBJECT_SELECTION');
  if (
    !Array.isArray(sinks) ||
    sinks.length === 0 ||
    sinks.length > 100 ||
    sinks.some(
      (sink) =>
        !sink ||
        typeof sink.id !== 'string' ||
        !SINK_ID.test(sink.id) ||
        !['account-keyed', 'operator-managed', 'shared-unresolved'].includes(
          sink.deletionMode
        )
    ) ||
    new Set(sinks.map((sink) => sink.id)).size !== sinks.length
  )
    return {
      allDeclaredSinksVerified: false,
      inventoryValid: false,
      results: [],
    };
  const subject: LogSubjectSelection = Object.freeze({
    accountId: selection.accountId.toLowerCase(),
    profileIds: Object.freeze([
      ...new Set(selection.profileIds.map((id) => id.toLowerCase())),
    ]),
  });
  const results: LogSinkResult[] = [];
  for (let index = 0; index < sinks.length; index++) {
    const sink = sinks[index];
    if (sink.deletionMode === 'shared-unresolved') {
      results.push({ sinkIndex: index, code: 'OWNERSHIP_UNVERIFIED' });
      continue;
    }
    const adapter = adapters.get(sink.id);
    if (!adapter) {
      results.push({ sinkIndex: index, code: 'PURGE_UNSUPPORTED' });
      continue;
    }
    try {
      await adapter.purge(subject);
    } catch {
      results.push({ sinkIndex: index, code: 'PURGE_FAILED' });
      continue;
    }
    try {
      const remaining = await adapter.readback(subject);
      results.push({
        sinkIndex: index,
        code:
          typeof remaining === 'number' &&
          Number.isSafeInteger(remaining) &&
          remaining >= 0
            ? remaining === 0
              ? 'PURGE_VERIFIED'
              : 'RECORDS_REMAIN'
            : 'READBACK_FAILED',
      });
    } catch {
      results.push({ sinkIndex: index, code: 'READBACK_FAILED' });
    }
  }
  return {
    allDeclaredSinksVerified:
      results.length === sinks.length &&
      results.every((result) => result.code === 'PURGE_VERIFIED'),
    inventoryValid: true,
    results,
  };
}
