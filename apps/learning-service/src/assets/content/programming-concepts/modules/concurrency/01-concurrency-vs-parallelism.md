# Two Words People Use Interchangeably

Every language you pick up next will have a story about "concurrency." Most of
that story quietly depends on you already knowing that concurrency and
parallelism are not the same thing. This lesson gives you the distinction so
the rest of the course (and the language you're about to learn) has
somewhere to attach.

---

## The Distinction

**Concurrency is a structuring choice.** It's how you write a program that
deals with several things at once (an HTTP handler, a background job, a
timer) without necessarily running them at the same instant. It's about the
_shape_ of the code.

**Parallelism is an execution fact.** It's whether two pieces of work are
actually happening at the same instant, on different cores. It's about the
_hardware_, not the code.

A useful way to hold the two apart, borrowed from Rob Pike: concurrency is
about dealing with lots of things at once; parallelism is about doing lots of
things at once. "Dealing with" is a design property. "Doing" is a runtime
property. You can have either without the other.

---

## Concurrency Without Parallelism

Run this mental model on a machine with exactly one core. A single-core
machine can still run concurrent code: it just can't run any of it in
parallel. The scheduler interleaves the work: run a bit of task A, pause it,
run a bit of task B, pause it, back to A. From the outside, both tasks make
progress. At no point are two instructions executing simultaneously, because
there is only one core to execute on.

This is not a corner case you can ignore. It's how single-threaded event
loops have worked for decades: one thread, many in-flight operations,
zero parallelism. A single-threaded JavaScript event loop juggling multiple
pending network requests is concurrent and not parallel. Go's goroutines run
this way too when `GOMAXPROCS=1`: thousands of goroutines, one OS thread
underneath them, taking turns.

```go
// This code is concurrent regardless of how many cores run it.
// Whether any two goroutines ever execute at the same instant
// is a fact about the machine, not about this code.
for i := 0; i < 1000; i++ {
    go doWork(i)
}
```

The `go` keyword asks for concurrency: "run this independently of what
follows." It says nothing about parallelism. That's decided later, by
`GOMAXPROCS` and how many cores are actually available.

---

## Parallelism Without Concurrency (Sort Of)

The reverse case is narrower but worth naming: pure data parallelism, where
the same operation runs across many independent chunks of data with no
interleaving logic between them: a matrix multiply split across cores, an
image filter applied row-by-row on a GPU. There's no scheduling story, no
message passing, no shared mutable state to reason about. It's parallel
without needing much of what people usually mean by "concurrent programming."
Most real programs aren't this clean, but it's a useful boundary case: it
shows that parallelism doesn't _require_ the structuring machinery
concurrency is built around.

---

## Why the Conflation Costs You

Treat the two as synonyms and you'll expect things that don't follow.

**"I added goroutines, so it'll be faster."** Not necessarily. If the work is
CPU-bound and `GOMAXPROCS` is 1, or if every goroutine immediately blocks on
the same mutex, you've added concurrency and gained no parallelism at all:
possibly a slowdown, from scheduling overhead. Speed comes from parallelism.
Concurrency buys you structure: the ability to express "these things don't
depend on each other" or "keep making progress on B while A waits on I/O."
Whether the runtime cashes that in for actual simultaneous execution is a
separate question, answered by core count and scheduler, not by your syntax.

**"Concurrent code needs multiple cores to make sense."** Also not true. A
single-core web server handling thousands of concurrent connections via an
event loop gets real value from concurrency (it stays responsive to new
connections while old ones wait on I/O) without touching a second core.
Concurrency's payoff there is _responsiveness under waiting_, not throughput.

The practical rule: concurrency is what you design for correctness and
responsiveness: dependencies, ordering, "does this need to see that." Parallelism
is what you measure for speed, and you measure it on the actual hardware, not
in the source code.

---

## Where This Gets Worked Out Properly

This course stays at the level of names and boundaries. The mechanics live in
the language courses:

1. Go's goroutines and scheduler: `letsgogo/modules/concurrency/01-goroutines-101.md`
2. Go's channels, the pipes that let concurrent goroutines coordinate: `letsgogo/modules/concurrency/02-channels.md`
3. Go's `sync.WaitGroup`, for waiting on concurrent work to finish: `letsgogo/modules/parallelism/01-waitgroup-mutex.md`
4. Rust's threads, spawned with `thread::spawn` and joined explicitly: `letsgorust/modules/concurrency/01-threads.md`
5. C++'s `std::thread`, the closest thing to the OS primitive with the least language help: `letsgocpp/modules/modern-cpp/03-concurrency.md`

Read the concurrency primitives in whichever of those you're learning with
this distinction in hand, and a lot of otherwise-mysterious behavior (why
adding goroutines didn't speed anything up, why a single-threaded runtime can
still stay responsive) stops being mysterious.

---

## Summary

1. Concurrency is a structuring choice about your code; parallelism is a fact about execution on hardware
2. A single-core machine can run concurrent code with zero parallelism: interleaving, not simultaneity
3. Pure data-parallel work can be parallel with almost none of the structuring concerns concurrency is about
4. Adding concurrency primitives does not guarantee a speedup: that depends on cores and contention, not syntax
5. Concurrency's payoff is often responsiveness, not throughput; parallelism's payoff is throughput
