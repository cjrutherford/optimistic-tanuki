# The Problem Underneath Everything

A data race, a stale-reference bug, and a borrow-checker error are not three
problems. They are one problem, showing up at three different points in a
program's life: two paths to the same mutable data, at least one of them
writing, with nothing coordinating them. Every mechanism the rest of this
course looks at (mutexes, ownership rules, garbage collection, `const`)
exists because of this one problem. This lesson names it once, in full,
before the language courses show you three different sets of tools for
managing it.

---

## The Shape of the Problem

Strip away syntax and every instance looks the same:

1. Some mutable data exists.
2. More than one path can reach it: two variables, two threads, a caller
   and a callee, an iterator and the loop mutating what it iterates.
3. At least one of those paths writes.
4. Nothing enforces an order between the paths.

That's the whole thing. Every symptom below is this shape, wearing a
different name because of _when_ it's caught or _how_ it manifests.

---

## Costume One: The Data Race

Two threads, no coordination, both touching the same variable.

```go
var counter int

func increment() {
    temp := counter
    temp++
    counter = temp
}

// launched 1000 times as goroutines
```

`temp := counter` reads, `temp++` computes, `counter = temp` writes: three
steps, and another goroutine can run its own three steps interleaved with
any of them. Two increments can both read the same starting value and both
write back one more than it, and one increment is silently lost. This is
`apps/learning-service/src/assets/content/letsgogo/modules/parallelism/03-race-conditions.md`
worked through in full, with the fix (`sync.Mutex`, `atomic`, or a channel)
explained in Go's terms. The shape of the fix is always the same: force an
order onto the two paths, either by locking one out while the other runs
(mutex) or by making the operation atomic so there's no window between read
and write for a second path to land in.

---

## Costume Two: Aliasing Without a Thread in Sight

You don't need concurrency to hit this. A single thread with two names
pointing at the same mutable object has the identical structure: path one
and path two, one of them writing, no enforced order between "which name
gets used when."

```python
def process(items):
    items.append("processed")

data = ["a", "b"]
process(data)
data.append("c")
print(data)  # ["a", "b", "processed", "c"] — surprising if you expected
             # process() to work on an independent copy
```

There's no race here in the threading sense. Everything happens in one
sequential order. But the underlying issue is the same: `data` and the
`items` parameter inside `process` are two paths to one mutable list, and if
you weren't expecting the function to mutate what you passed it, this is a
bug for exactly the reason a data race is a bug: a write through one path
was invisible to your mental model of the other path.

---

## Costume Three: The Borrow Checker Error

Rust catches this same shape before the program runs, by making "how many
paths currently exist to this data, and can any of them write" a fact the
compiler tracks at every point in the code.

```rust
let mut s = String::from("hello");

let r1 = &s;      // OK — a read-only path
let r2 = &s;      // OK — a second read-only path, no conflict between two readers
// let r3 = &mut s; // ERROR: cannot borrow as mutable while borrowed as immutable
```

The rule Rust enforces (one mutable reference, _or_ any number of shared
references, never both at once) is not an arbitrary restriction invented
for this language. It is a direct, compile-time statement of step 2 and
step 3 above: multiple paths are fine as long as none of them writes; the
instant one writes, every other path has to be gone first. `apps/learning-service/src/assets/content/letsgorust/modules/ownership/02-borrowing.md`
lays out the rule in Rust's own terms. Go there for the mechanics of `&`
and `&mut`. What matters here is what the rule is _for_: it is the exact
same hazard as the Go data race above, caught before compilation finishes
instead of by a race detector at runtime, because Rust makes "how many
mutable paths exist right now" a fact visible in the type system rather
than a fact only visible while the program is running.

---

## Three Strategies, One Target

Every language answers this problem with some combination of three
strategies, and it's worth being able to name which one you're looking at:

**Prevent the second path from existing.** Rust's borrow checker is this,
enforced at compile time. Move semantics, from the first lesson in this
module, are the same strategy applied to ownership transfer: moving a value
invalidates the old name so there is, provably, only one path left.

**Serialize access to the shared path.** Mutexes, atomics, and channels
don't reduce the number of paths: they make the paths take turns. This is
what Go's `sync.Mutex` and `atomic.AddInt64` do in the race-conditions
lesson above, and it's the strategy of choice whenever multiple threads
genuinely need to share one piece of mutable state.

**Make the data unable to carry the hazard.** If the value can't be
mutated (an immutable value type, or a persistent collection from the
previous lesson), then having multiple paths to it is no longer dangerous,
because none of them can write. This is why immutability keeps coming up in
concurrent and functional code: it doesn't solve the shared-access problem,
it makes the problem inapplicable by removing step 3 entirely.

---

## Reading the Rest of This Course With This in Hand

From here on, when a lesson introduces a lock, a borrow rule, a `const`, or
a rule about what a function can do to its arguments, it is very likely
doing one of these three things to this one problem. The scope-and-lifetime
lesson that follows this one adds the remaining piece: _when_ a path stops
existing at all, which is what determines how long any of these hazards
have a window to occur in.

1. Name the shape first: how many paths, does one of them write, is there an
   enforced order.
2. Ask which strategy the language feature in front of you is using:
   preventing a second path, serializing the paths, or removing the ability
   to write.
3. Expect the same three strategies to reappear, in different syntax, in
   every language you learn after this course.
