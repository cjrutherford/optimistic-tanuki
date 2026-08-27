# The Read, the Change, and the Gap Between

This is the central lesson of this module. Everything before it set up the
scene; everything after it is either the fix or the fine print on the fix.
The problem itself, the lost update, is small enough to state in one
sentence: when two writers each read a value, compute a new value from
what they read, and write it back, the second write can overwrite the
first writer's change instead of combining with it, and nothing in the
system raises an error when this happens.

---

## Walking It Through, Precisely

Take the naive handler from the previous lesson, applied to one row in
`lp_lesson_progress` for a learner who solves two exercises, A and B,
close enough together that the requests overlap:

```text
Request 1 (exercise A):
  read row -> completedExerciseIds = [], points = 0
  compute -> completedExerciseIds = ["A"], points = 10

Request 2 (exercise B):
  read row -> completedExerciseIds = [], points = 0
  compute -> completedExerciseIds = ["B"], points = 15

Request 1 writes -> completedExerciseIds = ["A"], points = 10
Request 2 writes -> completedExerciseIds = ["B"], points = 15
```

Both requests read the same starting state, because request 2's read
happened before request 1's write landed. Both computed a correct answer
_given what they read_. Both wrote. The row after both requests finished
says the learner solved exercise B for fifteen points. Exercise A, and its
ten points, are gone: not stored anywhere, not logged as an error, not
recoverable, because nothing about either write was invalid on its own
terms. This is the lost update, and the word "lost" is precise: the data
did not fail to be written, it was written and then silently overwritten
by a write that did not know about it.

---

## Why This Is Not a Locking Problem You Can Think Your Way Out Of

The instinct is to reach for a lock: hold a mutex around the read and the
write, so request 2 cannot start its read until request 1's write has
committed. That works, and it is a legitimate fix in a single process. It
does not fix this case cleanly, because the "process" here is a database
serving many connections, possibly many application instances, and a
mutex held in one instance's memory says nothing about a request handled
by a different instance, or even a different connection in the same
instance racing against it. You would need a lock that lives somewhere all
writers can see and coordinate through, which is either the database
itself or a distributed lock service you now have to operate and reason
about the failure modes of.

The deeper issue is that a lock around read-compute-write is treating the
symptom. The actual defect is that the computation ("append this id if
it's not already there, add these points if it wasn't already counted")
was done in application code, using data that was already stale by the
time the write landed. Locking makes the staleness impossible by forcing
serialization. The next lesson takes a different approach: make the
staleness irrelevant, by never computing the new value in application code
at all.

---

## Naming the Shape So You Recognize It Elsewhere

Read-modify-write races share this exact shape wherever they occur, not
just here:

1. A value is read.
2. A new value is computed from the old one, in application code, outside
   the database.
3. The new value is written back.
4. Nothing prevents a second reader from reading between steps 1 and 3 of
   the first writer.

A shopping cart total recomputed by reading every line item, an inventory
count decremented by reading the current count and subtracting one, a
"last seen" timestamp set by reading the row and checking if the new
timestamp is later: all of these have the shape, and all of them lose
updates under concurrent writers unless something changes step 2 so that
it does not depend on stale data read outside the write itself.

---

## What the Fix Has to Do

The fix cannot be "read faster" or "hope requests do not overlap." It has
to remove the gap between read and write, which means the decision of what
the new value should be cannot be made by application code holding a
possibly-stale read. It has to be made by whatever is doing the write, at
the moment of the write, against whatever the current value actually is at
that instant. That is a description of a single database statement that
reads and writes atomically, which is exactly what the next lesson shows
working in this codebase.

1. A lost update needs no bug in the logic that computed either write; both
   computations can be correct given what each writer read.
2. Locking around read-compute-write treats the symptom and is often
   impractical across processes; removing the gap is the real fix.
3. Recognize the shape (read, compute in application code, write back)
   anywhere a value is derived from itself, not just in this one table.
