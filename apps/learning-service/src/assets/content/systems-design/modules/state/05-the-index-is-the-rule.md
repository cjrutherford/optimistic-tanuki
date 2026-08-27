# The Constraint Is the Rule, Not the Comment

The previous lesson showed one statement closing the gap that causes a
lost update: `INSERT ... ON CONFLICT ("profileId", "lessonId") DO UPDATE`.
This lesson is about the two words doing the actual work in that sentence:
`ON CONFLICT`. A conflict is not a concept the statement invents on the
spot. It is a fact about the schema, and the statement can only detect a
conflict where the schema has told the database one is possible. Remove
that piece of schema, and the statement above does not fail, does not
warn, and does not behave the same way. It just stops protecting anything.

---

## Where the Conflict Comes From

`LessonProgressEntity`, in
`apps/learning-service/src/entities/lesson-progress.entity.ts`, declares:

```ts
@Index(['profileId', 'lessonId'], { unique: true })
@Index(['userId'])
@Index(['profileId'])
export class LessonProgressEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @Column({ type: 'uuid' }) profileId!: string;
  ...
  @Column({ type: 'varchar', length: 192 }) lessonId!: string;
  ...
}
```

The primary key on this table is `id`, a generated UUID, unrelated to which
learner or which lesson the row is about. On its own, a fresh UUID primary
key means nothing stops two rows from existing for the same
`(profileId, lessonId)`. What makes `(profileId, lessonId)` a valid target
for `ON CONFLICT` is the separate unique index declared right above the
class, and the comment on it says exactly why it is there: "recordSolvedExercise
merges awards with `INSERT ... ON CONFLICT ("profileId", "lessonId")`, and
Postgres resolves that target against a unique index on exactly those
columns. Without this the merge has nothing to conflict on."

---

## What Happens If You Remove It

Picture the index gone, the SQL statement in the previous lesson
unchanged, and the same two overlapping requests: exercise A and exercise
B solved close together by the same learner in the same lesson. Both
requests still run `INSERT ... ON CONFLICT ("profileId", "lessonId") DO
UPDATE`. But there is no unique constraint on those two columns anymore,
so there is nothing for either insert to conflict against. Both inserts
succeed as plain inserts. The result is two separate rows for the same
learner and the same lesson: one recording exercise A and ten points, the
other recording exercise B and fifteen points, sitting side by side, each
believing it is the row for this learner's progress on this lesson.

Nothing raises an error. The statement is syntactically identical to the
one in the previous lesson and does not throw a "no unique or exclusion
constraint" failure until something actually tries to violate a
constraint that no longer exists, which never happens because there is no
constraint to violate. Every downstream reader that expects one row per
learner per lesson (a dashboard summing points, a completion check looking
for one row) now has to reckon with duplicates that should have been
impossible. The protection that the previous lesson demonstrated so
cleanly is not weakened. It is gone, and gone silently, in a way that
would pass a code review focused on the SQL statement alone, because the
SQL statement did not change.

---

## Why This Belongs to Correctness, Not Tuning

It is easy to file a unique index under performance: an index makes
certain lookups faster, and dropping one that looks unused is a reasonable
thing to try during a cleanup pass. That instinct is exactly what makes
this index dangerous to remove by accident. This particular index is not
there to make a query faster. It is there to give `ON CONFLICT` something
to detect. Its presence is a precondition for the atomic merge in
`recordSolvedExercise` to merge anything at all, rather than silently
degrading into an ordinary insert that duplicates rows under concurrent
writers.

That makes the index part of the correctness of the code that uses it, in
the same sense that a function's return type is part of its correctness.
A reviewer reading `recordSolvedExercise` in isolation, without also
reading the entity file, would see a statement that looks self-evidently
correct: it merges. Whether it actually merges depends on a fact declared
in a different file, in a different part of the codebase, that nothing in
the SQL statement itself asserts or checks. The comment on the entity is
what closes that gap for a human reader; nothing closes it for a database
that has already lost the index.

---

## The General Version

Any `ON CONFLICT`, `MERGE`, or upsert relies on a uniqueness guarantee it
did not create and cannot enforce on its own; it can only act on a
guarantee that already exists. Before trusting an upsert to protect
against a lost update, confirm the constraint it targets is unique, is
still declared, and covers exactly the columns the conflict clause names.
A constraint covering more columns, fewer columns, or the same columns in
a schema that later changed underneath it can silently turn a merge back
into a race, without a single line of the merging code changing at all.

1. An `ON CONFLICT` clause is only as protective as the unique constraint
   it targets; the SQL statement cannot create that guarantee itself.
2. Do not treat a unique index that backs a conflict target as a
   performance knob available for routine cleanup; removing it removes
   correctness, silently.
3. When reviewing an upsert for correctness, read the constraint it
   targets in the schema, not just the statement itself.
