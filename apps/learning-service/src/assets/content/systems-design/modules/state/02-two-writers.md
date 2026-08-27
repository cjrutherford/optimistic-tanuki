# When Two Writers Arrive at Once

The previous lesson established that one service should own a given piece
of state. It did not say that service only ever handles one write at a
time. A single owner still fields concurrent requests, and this lesson sets
up the problem that creates: what happens when two writes to the same row
arrive close enough together that the second one starts before the first
one finishes.

---

## A Row Worth Picking On

Take one row in `lp_lesson_progress`: a learner's progress on a single
lesson, tracked by `profileId` and `lessonId`. It holds whether the lesson
is completed, which exercises within it have been solved, and how many
points the learner has earned from it. A learner working through a lesson
with several exercises can solve two of them in quick succession, and each
solved exercise triggers a call that is supposed to add that exercise's
points to the row and record it as done.

Two calls, one row, arriving close together. That is the entire setup. It
does not require malice, a bug elsewhere, or an unusual load pattern; it
only requires two things happening fast enough that the system's ordinary
concurrency handles them as overlapping requests, which is the normal case
for any service under real traffic, not an edge case.

---

## What "Close Together" Actually Means

It is tempting to picture this as two requests arriving at literally the
same instant, but that is not the shape that matters. What matters is
whether request B starts before request A has finished changing the row.
Any handler that reads a row, computes a new value in application code, and
writes that value back has a gap between the read and the write, and that
gap is the entire window during which "close together" is dangerous. The
gap can be microseconds. It does not need to be visible in a log to be
real.

Two exercises solved seconds apart, handled by two separate requests,
overlap in this sense if the first request's read-compute-write cycle has
not finished committing before the second request's read happens. Under
load, with connection pooling, async I/O, and a database that itself takes
nonzero time to apply a write, that overlap is not rare; it is the default
unless something specifically prevents it.

---

## What Naive Code Looks Like Here

Nothing in this lesson runs yet. The failure mode belongs to the next
lesson, in detail, but it is worth sketching what the tempting version of
this handler looks like before you have seen why it is wrong:

```text
read the row for (profileId, lessonId)
if exercise.id is not already in completedExerciseIds:
    append exercise.id to completedExerciseIds
    add exercise.points to points
write the row back
```

This reads as obviously correct, because it is correct for exactly one
request at a time. Nothing about the code changes when a second request is
introduced; the bug is not in any line of it. It is in the gap between the
first line and the last one, and what a second request is allowed to do
during that gap. That gap, and what falls into it, is the subject of the
next lesson.

---

## Why This Deserves Its Own Lesson

It would be easy to fold this straight into the fix and skip past naming
the problem on its own. The problem is worth isolating because the shape
generalizes past this one table: any handler that reads state, computes a
change based on what it read, and writes the result back has this gap,
regardless of the language, the framework, or whether the state lives in
Postgres, a cache, or an in-memory map shared by two request handlers in
the same process. Naming it once, precisely, means recognizing it on sight
in code that looks nothing like this example.

1. Two writers do not require two services or two machines; two overlapping
   requests to one service are enough.
2. The dangerous window is the gap between a read and the write that
   depends on it, not any particular clock duration.
3. Code that looks correct for one caller can be silently wrong for two,
   with nothing in the code itself pointing at where.
