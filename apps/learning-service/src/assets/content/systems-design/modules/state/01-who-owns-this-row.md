# Who Owns This Row

Every piece of mutable state in a distributed system needs exactly one
answer to the question "who is allowed to write this," and the answer needs
to be a single service, not a set of services that coordinate. This is not
a stylistic preference. It is the precondition for everything the rest of
this module argues: the lost-update problem, the fix for it, and the
constraint the fix depends on all assume there is one writer to reason
about. This lesson is about establishing that precondition before the
module needs it.

---

## One Owner, Many Askers

In this platform, a learner's progress through a lesson is owned by the
learning service. Nothing else writes to the `lp_lesson_progress` table.
The gateway does not touch it directly; it sends a command,
`LearningCommands.SaveLessonProgress` or the command behind
`recordSolvedExercise`, and the learning service is the only code that
turns that command into a write. Every other service that cares about a
learner's progress (if one existed) would ask the learning service, not
read the table itself.

This is the same shape as the boundary lessons from the earlier module,
looked at from the data side rather than the process side. "One service
owns this data" is what a well-drawn boundary produces, and it is worth
stating as its own rule because it is easy to violate quietly: a second
service granted direct database access "just for reporting," or a shared
table two services both feel entitled to write to, breaks the guarantee
without breaking anything obviously, right up until two writes collide.

---

## A Catalog With Two Owners, and What That Cost

The learning service's own catalog shows what happens when a single piece
of state has two sources that both believe they are authoritative.
`listPrograms`, in the repository, builds the course catalog from two
places: four courses defined in code, and any rows stored in the
`program_track` table by authors. An earlier version treated a non-empty
table as a full replacement for the code-defined courses. The moment
anyone authored a single course through the product, every built-in course
vanished from the catalog, because the code that assembled the catalog
believed the database was now the sole owner of "what courses exist," and
the database did not know about the four it had never been told to store.

The fix does not resolve this by picking one owner and discarding the
other. It resolves it by making the ownership explicit at the point of
read: build a map, seed it with the code-owned defaults, then let any
stored row of the same id shadow its built-in. That is still one rule for
who wins, decided in one place, rather than two sources of truth trusted
inconsistently depending on which happened to run last.

---

## Why "Everyone Asks" Beats "Everyone Can Write"

The alternative to single ownership is not usually stated that baldly; it
creeps in as "just this once, service B writes this table directly, it's
faster." The cost shows up later and is hard to attribute, because by the
time two writers collide, neither one did anything wrong in isolation. The
next two lessons in this module work through exactly that collision: two
writers arriving at the same row at once, and the specific way a naive read
modify write loses one of them. None of that analysis is meaningful until
this lesson's rule is in place first: name the one owner, route every write
through it, and let everyone else ask rather than touch.

---

## Recognizing a Violation

A useful test: for any table, can you point to the one code path that
writes it? If the answer is "several, in different services," or "several,
in the same service, that don't share a merge strategy," that is not yet a
bug, but it is the precondition for one. The lost-update problem in the
next lesson does not require two different services; it only requires two
writers, and "one service, two request handlers" is enough writers to have
the problem.

1. For any piece of mutable state, name the one service that owns writing
   it, and route every other consumer through a read, not a write.
2. Two sources that can each believe they are authoritative, like the
   catalog's code defaults and stored rows, need an explicit merge rule
   decided once, not an assumption that only one will ever be populated.
3. Single ownership is the precondition for reasoning about concurrent
   writers at all. Establish it before diagnosing a collision, not after.
