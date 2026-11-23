/**
 * Append-only audit of owner-console operator actions that have no case or run record of their own. One row per
 * action, written in the same transaction as the change it describes wherever the change is transactional.
 */
export type OperatorEventKind =
  | 'taxonomy_mapping'
  | 'boundary_lock'
  | 'reviewed_binding'
  | 'job';

export interface OperatorEvent {
  kind: OperatorEventKind;
  subjectId: string;
  action: string;
  actorId: string;
  reason?: string | null;
  /** Machine values only (outcomes, counts, hashes); never free text. */
  detail?: Record<string, unknown> | null;
}

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<any[]>;
}

export async function recordOperatorEvent(
  q: Queryable,
  event: OperatorEvent
): Promise<void> {
  await q.query(
    `INSERT INTO directory_operator_event (kind,"subjectId",action,"actorId",reason,detail)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [
      event.kind,
      event.subjectId,
      event.action,
      event.actorId,
      event.reason ?? null,
      event.detail ? JSON.stringify(event.detail) : null,
    ]
  );
}
