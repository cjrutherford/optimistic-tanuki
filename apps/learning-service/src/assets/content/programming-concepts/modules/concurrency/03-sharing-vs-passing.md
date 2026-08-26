# Share Memory or Pass Messages

Two threads need the same data. There are exactly two families of answer to
"how do they get it": let them both touch the same memory, under some
discipline that keeps them from stepping on each other, or hand the data
from one to the other so that, at any moment, only one of them can touch it
at all. Every concurrency primitive you'll meet across languages is a
variation on one of these two answers.

---

## Answer One: Share Memory, Under Discipline

Several threads hold a reference to the same piece of data. A mutex (mutual
exclusion lock), or a reader-writer lock, or an atomic, is the discipline
that keeps concurrent access from becoming a data race. Whoever holds the
lock may touch the data; everyone else waits.

```rust
use std::sync::{Arc, Mutex};

let counter = Arc::new(Mutex::new(0));
let c = Arc::clone(&counter);

std::thread::spawn(move || {
    let mut num = c.lock().unwrap();
    *num += 1;
}); // lock released when `num` drops
```

```cpp
std::mutex mtx;
int counter = 0;

void increment() {
    std::lock_guard<std::mutex> lock(mtx); // RAII: released at scope exit
    ++counter;
}
```

The data has one home. Multiple threads can reach it, but the lock ensures
only one is _touching_ it at a time. This is the model C++ hands you almost
raw (`std::mutex`, `std::lock_guard`, `std::atomic`) with essentially no
compiler help verifying you locked the right thing before touching the
shared data. Rust offers the same primitives, `Mutex<T>` and `RwLock<T>`, but
the type system ties the lock to the data it protects: you cannot get a `&mut
T` out of a `Mutex<T>` without going through `.lock()`, so "forgot to lock
before touching the shared field" stops compiling rather than compiling and
occasionally corrupting memory. See
`letsgorust/modules/concurrency/03-shared-state.md` for `Mutex<T>`, `Arc<T>`,
and `RwLock<T>` in full, and Go's version in
`letsgogo/modules/parallelism/01-waitgroup-mutex.md`.

---

## Answer Two: Pass Messages, Move Ownership

Instead of letting several threads reach the same memory, one thread owns the
data, does what it needs to, then hands it (fully, not a reference to it)
to the next thread. At every point in time, exactly one place can touch the
value. There's no lock, because there's nothing to contend over.

```go
ch := make(chan int)

go func() {
    ch <- compute() // ownership of the result moves down the channel
}()

result := <-ch // this goroutine now owns it
```

```rust
let (tx, rx) = std::sync::mpsc::channel();

std::thread::spawn(move || {
    tx.send(compute_value()).unwrap(); // ownership moves with the send
});

let result = rx.recv().unwrap();
```

Rust's channel enforces this at compile time: `send` takes the value by
move, so the sending thread genuinely cannot touch it afterward; the compiler
rejects any attempt to. Go's channels don't enforce it; a goroutine can keep
a reference to something it sent and touch it later, which reintroduces
exactly the shared-memory problem this pattern is meant to avoid. The
discipline in Go is convention ("don't do that") not something the
compiler checks. See `letsgogo/modules/concurrency/02-channels.md` and
`letsgorust/modules/concurrency/02-channels.md`.

---

## Neither Is Universally Right

Go's documented culture leans hard toward message passing: "don't
communicate by sharing memory; share memory by communicating" is practically
the language's motto, and it shows up verbatim in the Rust channels material
too, since the idea predates both languages. But Go ships `sync.Mutex`
alongside channels precisely because message passing isn't the right shape
for every problem. Protecting a single piece of long-lived shared state
(a cache, a counter many things update) is often simpler with a mutex than
with a goroutine whose entire job is owning that state and answering requests
over a channel.

Rust makes both memory-safe (no data races in safe code, either way; see the
next section for the limits of that promise) and leaves the choice to you:
its standard library ships `Mutex`, `RwLock`, and `mpsc` channels side by
side, with no cultural lean toward one.

C++ gives you the primitives for both and stays out of the way entirely:
`std::mutex` for sharing, and message-passing is something you build
yourself out of a queue and a condition variable, or reach for a library for.
Neither is baked in as "the" way.

The actual decision criteria, independent of language:

1. **Lifetime of the sharing.** A value that's handed off once and then
   belongs entirely to the receiver fits message passing naturally. State
   that many threads need to read and update over a long period (a
   connection pool, a shared cache) often fits a lock better; funneling
   every read through a channel to an owning goroutine can be more machinery
   than the problem needs.
2. **Contention.** Heavy contention on a mutex serializes everything behind
   it regardless of how the code reads; a channel with one consumer has the
   same serialization, just spelled differently.
3. **What the language actually enforces.** Rust's compile-time guarantee
   changes the calculus versus Go or C++, where both approaches rely partly
   on discipline the compiler won't check for you.

---

## Message Passing Is Not Free

It's tempting, once you've picked message passing, to treat it as the safe
option and stop thinking. It has its own failure modes.

**Deadlock on unbuffered sends.** An unbuffered channel send blocks until
someone is ready to receive. Two goroutines each waiting to send to a channel
the other should be reading (with neither actually reading) deadlock just
as thoroughly as two threads each holding a lock the other wants.

```go
ch := make(chan int) // unbuffered

// If nothing is ever receiving on ch, this blocks forever.
ch <- 1
```

**Unbounded queues hide backpressure problems.** A buffered channel (or any
message queue) with no cap on size will happily let a fast producer outrun a
slow consumer, growing memory usage until something breaks, instead of
surfacing the mismatch immediately. A bounded channel makes the producer
block and _feel_ the backpressure; an unbounded one defers the reckoning to
whenever memory runs out.

**Ownership transfer isn't automatically correct just because it's a
transfer.** Sending a value down a channel doesn't guarantee anything about
_when_ the receiver will get to it, or what state the rest of the system is
in by then: that's still a design problem, just a different one than a data
race.

Locks fail loudly and locally, usually as a deadlock you can catch in
testing. Channel-based deadlocks and unbounded-queue memory growth can be
just as real and, because they involve more moving parts, sometimes harder to
localize. Neither family of tools makes the underlying coordination problem
disappear — they just give you different vocabulary for expressing the
solution, and different failure shapes when the solution is wrong.

---

## Summary

1. Sharing memory under a lock and passing messages to transfer ownership are the two answers to "how do threads use the same data"
2. Rust's type system ties locks to the data they guard; C++ hands you the primitives and trusts you to pair them correctly
3. Go's culture favors channels; its compiler doesn't enforce the discipline the way Rust's does
4. The right choice depends on lifetime of sharing and contention pattern, not a rule that one approach is always safer
5. Message passing has real failure modes too: deadlock on unbuffered sends, and unbounded queues that hide backpressure until memory runs out
