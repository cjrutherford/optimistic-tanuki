# Letting the Database Settle It

The previous lesson ended on a requirement: the decision of what a row's
new value should be cannot be made by application code holding a
possibly-stale read, because the gap between that read and the eventual
write is exactly where an update gets lost. This lesson shows the fix this
platform actually ships, in one real method, and names the principle it
demonstrates: send the change, not the computed result, and let one
statement do the merging.

---

## The Method

`recordSolvedExercise`, in `apps/learning-service/src/app/typeorm.repository.ts`,
handles a learner solving an exercise within a lesson. It does not read the
row, decide in application code whether the exercise is new, and write a
computed result back. It sends one statement:

```sql
INSERT INTO "lp_lesson_progress"
   ("userId", "profileId", "enrolmentId", "lessonId",
    "completed", "completedExerciseIds", "points")
 VALUES ($1, $2, $3, $4, false, $5::jsonb, $6)
 ON CONFLICT ("profileId", "lessonId") DO UPDATE SET
   "completedExerciseIds" =
     CASE WHEN "lp_lesson_progress"."completedExerciseIds" @> $5::jsonb
          THEN "lp_lesson_progress"."completedExerciseIds"
          ELSE "lp_lesson_progress"."completedExerciseIds" || $5::jsonb
     END,
   "points" =
     "lp_lesson_progress"."points" +
     CASE WHEN "lp_lesson_progress"."completedExerciseIds" @> $5::jsonb
          THEN 0 ELSE $6 END,
   "updatedAt" = now()
 RETURNING "lessonId", "completed", "completedExerciseIds", "points", "updatedAt"
```

Read what this statement is actually saying. It tries to insert a fresh
row. If a row for this `(profileId, lessonId)` already exists, it instead
updates that row, and the update reads the row's _current_ value of
`completedExerciseIds` inside the same statement that writes it: append
the new exercise id only if it is not already present, add its points only
if it was not already counted. There is no separate "read the row, decide
in the application, write the row" sequence at all. The read the decision
depends on and the write that acts on it are the same database operation.

---

## Why This Closes the Gap

Go back to the two overlapping requests from the previous lesson, exercise
A and exercise B, and run them against this statement instead of the naive
handler. Postgres serializes conflicting writes to the same row: whichever
`INSERT ... ON CONFLICT` reaches the row first executes completely,
including its read of the current `completedExerciseIds` inside the `CASE`,
before the second one's conflict-handling update is evaluated. The second
statement's `CASE` then reads the row _as the first statement left it_, not
the stale value the application saw before either request ran. Exercise A's
id and points are already in the row by the time exercise B's statement
checks what is already there, so B appends to A's result instead of
replacing it. Both exercises end up recorded, regardless of which request
happened to finish first. There is no window for either result to
disappear, because at no point does either statement act on a value that
was read outside of it.

---

## The Principle, Named

**Send the change, not the computed result.** The naive version sent "here
is the new `completedExerciseIds` array," computed by application code from
a value it read moments earlier. This version sends "here is the exercise
that was solved," and lets the database decide, at the instant of the
write, what that means for whatever the row's current state actually is.
The application never claims to know the row's current state; it only
states a fact about what happened (an exercise was solved) and trusts the
single statement to reconcile that fact with whatever else may have
happened concurrently.

This is a general move, not a Postgres trick specific to `jsonb`. Any
statement that expresses "add one to whatever this currently is" rather
than "set this to eleven," or "merge this element into whatever set exists"
rather than "set the set to these three elements," has the same property:
the merging logic lives inside the atomic operation instead of in a
read-then-write sequence that can be interrupted.

---

## What This Does Not Do

This fix does not require a lock, a queue, retry logic, or optimistic
concurrency checks with a version column. Those are all legitimate tools
for other shapes of the same underlying problem, but they are more
machinery than this case needs, because the merge here is simple enough to
express directly as SQL. Where the merge logic is too complex to state as
one statement, those other tools become the right answer, and this lesson
is not a claim that they are never needed. It is a claim that when the
merge can be stated this directly, doing so is simpler and more robust than
any of them.

There is one more thing this statement quietly depends on to work at all,
and it is not visible in the SQL above: the `ON CONFLICT ("profileId",
"lessonId")` clause needs something to conflict against. That dependency,
and what happens when it is missing, is the next lesson.

1. When a lost update is possible, prefer expressing the change as a
   statement the database applies atomically over reading, computing, and
   writing back in application code.
2. `INSERT ... ON CONFLICT ... DO UPDATE` lets the update clause read the
   row's live value in the same statement that writes it, closing the gap
   entirely rather than narrowing it.
3. Reach for locks, queues, or optimistic version checks when the merge
   logic is too complex to express as one statement, not as the default
   first tool.
