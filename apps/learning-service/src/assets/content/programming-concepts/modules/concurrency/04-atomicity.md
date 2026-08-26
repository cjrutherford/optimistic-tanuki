# The Smallest Thing That Cannot Be Interrupted

"Atomic" gets used loosely to mean "thread-safe." It means something much
narrower and more useful than that: an atomic operation is one that happens
as a single, indivisible step from every other thread's point of view. No
thread can ever observe it half-done. That narrowness is exactly what makes
atomics fast, and exactly what makes them unable to replace a lock in
general.

---

## Why `count++` Is Three Operations

Start with the thing that makes this lesson necessary: an operation that
looks like one step in source code is very often several steps once it
reaches the machine.

```go
count++
```

That single line is, underneath, at least three separate steps:

1. **Read** the current value of `count` from memory into a register
2. **Increment** the value in the register
3. **Write** the new value back to memory

Each of those three steps is a distinct instruction (or close to it). Nothing
stops another thread from running its own read, in between your read and
your write, and getting the same stale value you did. Two threads both read
`5`, both compute `6`, both write `6`: one increment is lost, and neither
thread did anything individually wrong. This is precisely the mechanism
behind the `counter` example the data-race lesson walked through: the
appearance of one operation hides a read-modify-write sequence that
concurrent execution can interleave with itself.

This is not specific to `++`. Any read-modify-write (appending to a
collection, updating a running total, incrementing a map value) has the same
shape: read, compute, write, as separate steps that another thread can slip
between.

---

## What "Atomic" Buys You

An atomic operation collapses that read-modify-write sequence into one step
that the hardware guarantees is indivisible. No other thread can observe the
memory location between the read and the write, because from the outside
there is no "between": the whole operation either hasn't happened yet or has
fully happened.

```go
var counter int64
atomic.AddInt64(&counter, 1)
```

```rust
use std::sync::atomic::{AtomicUsize, Ordering};

let counter = AtomicUsize::new(0);
counter.fetch_add(1, Ordering::SeqCst);
```

```cpp
std::atomic<int> counter{0};
counter++; // atomic increment, no mutex needed
```

Under the hood this usually rides on a CPU instruction built for exactly this
(compare-and-swap, fetch-and-add) rather than a general-purpose lock. That's
why atomics are typically faster than a mutex for the cases they cover: no
thread ever blocks waiting for another thread to release something, because
there's no window where the operation is incomplete for another thread to
collide with.

`AddInt64`, `fetch_add`, and `std::atomic<int>::operator++` are all the same
idea: take a specific read-modify-write pattern that's genuinely common
(increment, compare-and-swap, load, store) and give it hardware-backed
indivisibility instead of asking you to wrap it in a lock.

---

## Why Atomics Are Not a General Substitute for Locks

Here is the boundary that matters: an atomic makes **one** operation
indivisible. It cannot make **two separate operations** behave as if they
were one. That gap is exactly where atomics stop being able to replace a
mutex.

```go
// Each individual access is atomic. The sequence is not.
if atomic.LoadInt64(&balance) >= amount {
    // Another thread's withdrawal can land right here,
    // between the load and the store below.
    atomic.AddInt64(&balance, -amount)
}
```

The load is atomic. The subtract is atomic. But "check, then act on what you
checked" is two atomic operations with a gap between them, and the gap is
exactly where another thread can act. This is a race condition (the same
category the sharing-vs-passing lesson named) built entirely out of
individually-atomic pieces. Nothing here is a data race by the strict
definition: every access to `balance` goes through an atomic operation, fully
synchronized. The bug is that the _logic spanning two operations_ needed to
be treated as one unit, and atomics only ever cover one.

A mutex doesn't have this gap, because it protects a _region of code_, not a
single memory access:

```go
mu.Lock()
if balance >= amount {
    balance -= amount
}
mu.Unlock()
```

Everything between `Lock` and `Unlock` happens as one uninterruptible unit
from every other thread's perspective, no matter how many reads, writes, or
branches are inside it. That's the actual dividing line: reach for an atomic
when you have one value and one operation on it: a counter, a flag, a single
pointer swap. Reach for a mutex the moment correctness depends on more than
one operation happening together, even if each of those operations,
individually, would be a fine candidate for an atomic on its own.

---

## Summary

1. An operation that reads as one line (`count++`) is usually read, modify, write as three separate steps underneath, and another thread can interleave in the gaps
2. An atomic operation is indivisible: no other thread can observe it partway done
3. Atomics are typically faster than a lock because nothing ever blocks — there is no incomplete state to collide with
4. Atomics make one operation indivisible; they cannot make two operations behave as one
5. Check-then-act logic built entirely out of atomic pieces can still be a race condition: reach for a mutex once correctness spans more than a single operation
