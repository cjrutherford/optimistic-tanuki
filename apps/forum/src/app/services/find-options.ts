import { FindOneOptions, FindOptionsWhere, ObjectLiteral } from 'typeorm';

/**
 * Forces `id` into a find's where clause.
 *
 * The forum services used to build `{ where: { id }, ...options }`. Because the
 * spread comes second, a caller who passed their own `where` replaced the id
 * constraint outright and the query returned whatever row matched their filter
 * instead of the one they named. Merging in the other direction keeps any extra
 * conditions the caller asked for while guaranteeing the row is the one `id`
 * identifies.
 */
export function withIdConstraint<T extends ObjectLiteral>(
  id: string,
  options?: FindOneOptions<T>
): FindOneOptions<T> {
  const where = options?.where;

  // An array of where clauses is an OR: every branch has to be constrained,
  // otherwise the unconstrained ones still match other rows.
  // TypeScript cannot see that the entities all carry a string `id`, so the
  // merged clauses are cast through `unknown`; every forum entity does.
  if (Array.isArray(where)) {
    return {
      ...options,
      where: where.map((entry) => ({
        ...entry,
        id,
      })) as unknown as FindOptionsWhere<T>[],
    };
  }

  return {
    ...options,
    where: { ...(where ?? {}), id } as unknown as FindOptionsWhere<T>,
  };
}
