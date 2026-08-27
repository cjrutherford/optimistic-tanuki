# How a Schema and Its Code Come Apart

"Drift" is what happens when the schema a service's code believes it is
talking to and the schema actually sitting in the database stop being the
same thing. The dangerous property of drift is not that it happens; it's
that it happens without an error. Nothing crashes. The deploy succeeds, the
migration runs clean, the tests are green. The gap is invisible until
something on the far side of it depends on the piece that's missing, and by
then it isn't a code review comment, it's an incident. Three separate
mechanisms produced drift in this codebase. None of them threw an
exception.

---

## Mechanism One: A Missing Constraint, Found by What Depends On It

`LessonProgressEntity`, in
`apps/learning-service/src/entities/lesson-progress.entity.ts`, declares:

```typescript
@Index(['profileId', 'lessonId'], { unique: true })
@Index(['userId'])
@Index(['profileId'])
export class LessonProgressEntity {
  // ...
}
```

The hand-written migration that originally created this table did not
include that unique index. Nothing about running the migration revealed
the omission. It executed successfully, the table existed, columns had the
right types, and every test that built its schema straight from the entity
definitions saw the constraint, because in the entity's world it was always
there.

The gap only mattered to one specific piece of code:
`recordSolvedExercise` in `apps/learning-service/src/app/typeorm.repository.ts`
merges progress with:

```sql
INSERT INTO lp_lesson_progress (...)
VALUES (...)
ON CONFLICT ("profileId", "lessonId") DO UPDATE SET ...
```

`ON CONFLICT` names a target, and Postgres resolves that target against an
existing unique constraint or index on exactly those columns. Without one,
there is nothing to conflict with. The statement doesn't fail: it inserts a
second row. Two exercises finishing close together, instead of merging into
one progress record, silently produce two, and whatever protected against a
lost update is gone without a single error message anywhere in the stack.

---

## Mechanism Two: Bookkeeping Keyed on a Name That Changed

TypeORM tracks which migrations have run in a table keyed by migration
**class name**, not by file path or content hash. That's an implementation
detail until someone renames a class for an unrelated reason.

That happened here: migration classes across a service were renamed to
satisfy the timestamp convention enforced by
`scripts/validate-typeorm-migrations.mjs` (a class name has to end in
exactly one 13-digit CLI timestamp, and the filename has to match it).
The rename was correct by that check. But TypeORM's migrations table still
held the _old_ class names as "already run." After the rename, the tool no
longer recognized those names, decided the migrations were pending, and
offered to run them again, against a database where their effects already
existed.

Two systems, each individually correct: a linter checking names, and a
migration runner checking a table. Neither one is aware of the other, and
the seam between them is exactly where a rename becomes a landmine.

---

## Mechanism Three: The Test Database Isn't Built the Way Production Is

Tests often build a schema straight from entity definitions: `synchronize`,
or an in-memory equivalent, rather than running the actual migration files.
This is faster and simpler to set up, and it is also the reason mechanism
one was invisible for as long as it was. A constraint present in the
entity is present in every test database built from the entity. It is
present in production only if the migration that ran there happened to
create it too.

```text
entity  ──defines──▶  what tests build their schema from
   │
   └────should also define────▶  what the migration builds

If those two arrows produce different schemas, tests are
validating a database that does not exist anywhere but the
test run.
```

The suite passes. The production schema is different. A green suite is
telling you the truth about the schema it built, which is not necessarily
the schema anything else is running against; this connects directly to
`knowing/01-green-is-not-working.md` later in the course.

---

## What All Three Have in Common

None of these was caught by a test failing, a migration erroring, or a
type check. Each was caught by someone noticing a symptom downstream:
duplicate rows where there should be one, a migration tool insisting on
re-running something that had already run, a schema that worked in every
test and nowhere else. Drift doesn't announce itself at the point it's
introduced. It announces itself, if at all, at the point something finally
needed the thing that quietly stopped being true.

1. A missing constraint is invisible until code that relies on it
   (`ON CONFLICT`, a foreign key, a `NOT NULL`) runs against real data.
2. Bookkeeping keyed on a name survives a rename by luck, not by design;
   check what identifies a migration as "already applied" before renaming
   anything near it.
3. A schema built from entities and a schema built from migrations are two
   different claims about the same table. A green suite only checks one
   of them.
