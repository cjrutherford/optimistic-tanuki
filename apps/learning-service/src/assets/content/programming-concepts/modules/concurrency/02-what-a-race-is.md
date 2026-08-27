# A Race Is Not Randomness

"Race condition" gets used as a catch-all for "concurrent code that
misbehaves." That's too loose to be useful. There is a precise thing called a
**data race**, a related but different thing called a **race condition**, and
the difference matters for what tools can and can't catch for you.

---

## The Precise Definition

A data race is:

1. Two or more accesses to the same memory location
2. At least one of them is a write
3. They happen concurrently, with no synchronization ordering one before the other

That's it. Not "the program computed the wrong number." Not "the output was
inconsistent." Two accesses, one memory location, at least one write, no
synchronization. If all three conditions hold, you have a data race, full
stop, independent of whether the program happened to produce a plausible
answer that run.

The Go course walks through the canonical version of this (an unprotected
`counter` incremented from many goroutines) in
`letsgogo/modules/parallelism/03-race-conditions.md`. Worth reading before
continuing here; this lesson builds on it rather than re-deriving it.

```go
var counter int

func increment() {
    temp := counter // read
    temp++
    counter = temp  // write
}

for i := 0; i < 1000; i++ {
    go increment()
}
```

Every `increment` call reads `counter`, then later writes it. With no lock,
no channel, no atomic operation ordering these against each other, two
goroutines can both read the same value, both add one, and both write the
same result back: one increment vanishes. That's the race.

---

## The Consequence Is Not "Wrong Output"

Here's the part most material glosses over: the consequence of a data race is
not "the program might compute the wrong number." It's **undefined
behavior**.

Compilers and CPUs are allowed to assume your program has no data races. That
assumption is load-bearing. It's what licenses a long list of optimizations:
reordering instructions, caching a value in a register instead of re-reading
memory, eliminating a "redundant" load, merging writes. Every one of those
transformations is only correct if nothing else is concurrently touching the
same memory in a conflicting way.

When you have a data race, that assumption is false, and the compiler doesn't
know it's false. It optimized as if the race couldn't happen. The result
isn't bounded to "sometimes off by one." It can be a torn read (part of an
old value, part of a new one, for multi-word data), a value that was never
written by any thread, a crash, or (in principle) anything, because the
license the compiler was operating under has been violated. In practice the
outcomes are usually mundane, but "usually mundane" is exactly the trap: it's
what lets a data race pass code review, pass testing, and ship, until the one
production run where the optimizer's assumption and reality diverge visibly.

This is why "just run it a few times and see if the number comes out right"
tells you almost nothing. A racy program can produce the correct output on
every run you happen to try and still be wrong.

---

## Data Race vs. Race Condition: Not the Same Thing

This is the distinction most tutorials blur, and it's worth being exact
about, because the two categories don't fully overlap.

A **race condition** is a broader idea: the correctness of a result depends
on the timing or interleaving of operations that are each, individually,
perfectly synchronized. Nothing here needs to be a data race: every access
can go through a lock, a channel, an atomic. The bug is in the _order_, not
in an unsynchronized memory access.

Concretely: imagine two goroutines, each holding a properly synchronized
check to see if a bank balance covers a withdrawal, then withdrawing. Each
individual read and write is protected by a mutex: no data race by the
definition above. But if goroutine A checks the balance, then goroutine B
checks and withdraws, then A proceeds with a now-stale check, the account can
go negative. Every memory access was synchronized. The _logic_ (check, then
act, without treating the two as one atomic unit) was not. That's a race
condition with zero data races in it.

The reverse also happens, though less often discussed: a data race that
never produces an observably wrong result, because the racing accesses
happen to be idempotent or the timing window never gets hit in practice. It's
still undefined behavior (the compiler still assumed no such access existed)
even if you never see a symptom.

|                                 | Data race                                 | Race condition                                                         |
| ------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| Requires unsynchronized access  | yes, by definition                        | no, every access can be locked                                         |
| Requires a write                | yes, at least one of the accesses         | no, the bug can be purely in ordering                                  |
| Can occur under correct locking | no, locking prevents it by definition     | yes, e.g. check-then-act across two correctly-locked operations        |
| Example above                   | `counter++` from many goroutines, no lock | balance checked, then withdrawn, each step locked, but not as one unit |

So: data race is about unsynchronized memory access. Race condition is about
outcome depending on interleaving. A data race is one way to get a race
condition, but check-then-act bugs over correctly-synchronized state get you
a race condition with no data race at all, and that combination is common
enough that treating the two terms as synonyms will cause you to reach for
the wrong fix.

---

## What Detection Tools Actually Promise

Go's race detector (`go run -race`, `go test -race`) is the most commonly
reached-for tool here, and it's worth being precise about what it does. It's
**dynamic**: it instruments memory accesses and watches the program actually
run, flagging data races on the code paths that were actually exercised. It
does not do static analysis of every possible interleaving.

That has one direct consequence: a race detector reports races on paths your
test suite happened to hit. A rare branch, an error-handling path, a case
your tests don't exercise: the detector has nothing to say about code it
never saw execute. "We ran with `-race` and it was clean" means "no races
were observed on the paths we exercised," not "this code has no races."
Broader test coverage makes the tool more useful; it doesn't change what kind
of guarantee it's giving you.

---

## Summary

1. A data race is precise: same location, concurrent access, at least one write, no synchronization
2. The consequence is undefined behavior, not merely "wrong output": the compiler's no-race assumption was violated
3. A race condition is broader: outcome depends on timing, even across fully-synchronized accesses
4. Check-then-act bugs over correctly-locked state are race conditions with zero data races
5. Race detectors are dynamic — they report what they observed running, not every path that exists
