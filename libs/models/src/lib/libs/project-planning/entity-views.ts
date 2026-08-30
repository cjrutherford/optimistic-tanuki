/**
 * What each thing looks like when the assistant asks for it.
 *
 * The tools returned whole rows with every id and timestamp on them, so a
 * question like "which tasks are unassigned" meant reading twenty thousand
 * characters of JSON to find six words. That is what made the assistant
 * describe payloads instead of answering, and what made a shortened result
 * lose the part that mattered.
 *
 * Two views rather than a list of field names. "brief" or "full" is one value
 * for a model to get right, where a list of names is several chances to spell
 * one wrong, and the choice is already in the schema it reads. There is
 * nothing to look up and no second call to make.
 *
 * The names here are the single definition. The tool schema advertises them
 * and the projection applies them, so a view cannot come to mean something
 * different from what the tool actually returns.
 */

export const ENTITY_VIEWS = ['brief', 'full'] as const;
export type EntityView = (typeof ENTITY_VIEWS)[number];

/**
 * The brief shape of each thing: what somebody would say out loud about it.
 *
 * Ids are kept because the tools need them to act on something afterwards.
 * Everything about who touched a row and when is left out, since no question
 * anybody asks an assistant is answered by an updatedAt.
 */
export const BRIEF_FIELDS: Record<string, string[]> = {
  task: [
    'id',
    'title',
    'description',
    'status',
    'priority',
    'assignee',
    'dueDate',
  ],
  risk: ['id', 'description', 'impact', 'likelihood', 'status', 'resolution'],
  change: [
    'id',
    'changeDescription',
    'changeType',
    'changeStatus',
    'changeDate',
  ],
  projectJournal: ['id', 'content', 'createdAt'],
  taskNote: ['id', 'content', 'createdAt'],
  project: ['id', 'name', 'description', 'status', 'startDate', 'endDate'],
  taskTimeEntry: [
    'id',
    'startTime',
    'endTime',
    'elapsedSeconds',
    'description',
  ],
};

/**
 * Narrows rows to a view, saying which fields were left out.
 *
 * The omission is named rather than silent. A reader who cannot tell a field
 * is missing from a field being empty has no way to know what to ask for
 * next, and silent absence is what made the earlier truncation bug take an
 * afternoon to find.
 */
export function applyView<T extends Record<string, unknown>>(
  rows: T[],
  entity: keyof typeof BRIEF_FIELDS | string,
  view: EntityView = 'brief'
): { rows: Partial<T>[]; omitted?: string[] } {
  const keep = BRIEF_FIELDS[entity];
  if (view === 'full' || !keep) return { rows };

  const omitted = new Set<string>();
  const narrowed = rows.map((row) => {
    const out: Partial<T> = {};
    for (const key of Object.keys(row)) {
      if (keep.includes(key)) {
        out[key as keyof T] = row[key] as T[keyof T];
      } else {
        omitted.add(key);
      }
    }
    return out;
  });

  return omitted.size
    ? { rows: narrowed, omitted: [...omitted].sort() }
    : { rows: narrowed };
}
