import { Project } from '../entities/project.entity';

/**
 * Drops soft-deleted rows from a loaded project.
 *
 * deletedAt is a plain column rather than a DeleteDateColumn, so TypeORM does
 * not filter it and a relation load returns deleted rows. A deleted task
 * therefore vanished from the task table and stayed on the board: the counts,
 * the summary figures and the project handed to the model all described work
 * nobody could see, and the two views of one project disagreed.
 *
 * Done after loading rather than as a condition in the query. A relation
 * condition in `where` filters the joined rows, so a project whose tasks were
 * all deleted would disappear entirely rather than come back empty.
 */
export function withoutDeletedChildren<T extends Partial<Project>>(
  project: T
): T {
  const alive = <R extends { deletedAt?: Date | null }>(rows?: R[]) =>
    rows?.filter((row) => !row.deletedAt);

  return {
    ...project,
    ...(project.tasks ? { tasks: alive(project.tasks) } : {}),
    ...(project.risks ? { risks: alive(project.risks) } : {}),
    ...(project.changes ? { changes: alive(project.changes) } : {}),
    ...(project.journalEntries
      ? { journalEntries: alive(project.journalEntries) }
      : {}),
  };
}
