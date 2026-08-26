# What a Loop Actually Costs

A `for` loop feels free. It's the first control-flow construct most people
learn, it reads almost like English, and every language in these courses
supports some form of it. But a loop that accumulates a result is quietly
doing something this course has already spent a module warning about: it's
building a small, bounded piece of shared mutable state and updating it
across time.

Seeing that clearly is the setup for the rest of this module, which spends
three lessons on alternatives (recursion, tail calls, and iterators) that
each handle the same problem differently.

---

## The Anatomy of an Accumulating Loop

```go
sum := 0
for i := 0; i < len(prices); i++ {
    sum += prices[i]
}
```

Two variables are doing work here that a first glance skips past: `i`, the
counter, and `sum`, the accumulator. Both live outside the loop body, both
get mutated on every iteration, and both are fully mutable for the loop's
entire lifetime: nothing stops any line inside the loop from reassigning
either one to something unexpected.

```ts
let total = 0;
for (let i = 0; i < prices.length; i++) {
  total += prices[i];
}
```

```cpp
int total = 0;
for (int i = 0; i < prices.size(); ++i) {
    total += prices[i];
}
```

Same shape, three languages. In every case the loop's real work is
mutation: `sum`/`total` after the loop is not the same value it was before.
It's the same _variable_, walked through a sequence of different values,
one per iteration.

Rust's more common idioms lean away from writing the counter out by hand at
all, iterating over a range or a collection directly:

```rust
let mut total = 0;
for price in &prices {
    total += price;
}
```

The counter is gone from view, but the accumulator, `total`, is still
sitting there as a mutable variable carrying the running sum across
iterations: the part of the pattern this lesson is actually about doesn't
go away just because the indexing arithmetic does.

---

## Why "Small and Bounded" Still Matters

This is not the shared mutable state from the concurrency material, which
gets dangerous because multiple threads can touch it at once, at moments
whose order is not fixed. A single-threaded loop's `sum` is safe from that
specific danger: only one thread ever touches it, and it touches it in a
strict, predictable order.

But it's still mutable state, and three of its costs show up even with a
single thread:

**It has a lifetime bug waiting to happen.** `sum` exists before the loop
starts and after it ends, at zero or at its wrong final value respectively,
if you read it at the wrong line. A bug that reads the accumulator one
statement too early is a real, common mistake, and the value is _there_, typed
correctly, just not yet finished.

**It couples every iteration to every other.** Because `sum` after
iteration 5 depends on `sum` after iteration 4, the iterations cannot be
reordered, skipped, or run out of sequence without changing the answer.
That's fine for addition, which doesn't care about order. But the loop's
_shape_ doesn't express that fact. Nothing in `for i := 0; ...; i++` tells a
reader "this would still be correct in any order." You'd have to check the
body to know.

**It's a second thing to get right, beyond the logic.** Writing `sum += x`
instead of `sum = x`, or forgetting to reset `sum` to zero before a second
use of the same loop shape, are mistakes about the _bookkeeping_ of the
accumulator, entirely separate from mistakes about what should be summed.
The two concerns (what to compute, and how to carry the running total from
one iteration to the next) are tangled into the same three lines.

---

## The Counter Has the Same Problem

`i` gets less attention than `sum` because incrementing a loop counter feels
too mechanical to be a "bug," but it's the same pattern: a mutable variable,
reassigned every iteration, whose current value determines what happens
next. Off-by-one errors (`<=` where you meant `<`, starting at `1` where you
meant `0`) are counter bookkeeping mistakes, and they are one of the most
common categories of bug in loop-heavy code across every language, precisely
because the counter is mutable state that has to be gotten exactly right on
every single iteration, including the first and the last.

---

## Not an Argument Against Loops

None of this is "loops are bad." A loop over a slice, computing a sum, is
often the clearest possible way to say what you mean, and every language
here will keep using them constantly, including inside this course's own
existing lessons. The point is narrower: a loop that accumulates is not
free of the cost that shared mutable state carries elsewhere in these
courses: it has just shrunk that cost down to a single thread, a bounded
number of variables, and a lifetime of one function call, which is why it
usually doesn't hurt.

The next three lessons look at what happens when you refuse even that small
amount of mutation. Recursion replaces the accumulator variable with a value
carried through function arguments. Tail calls ask whether that replacement
is free or costs you a stack frame per iteration. Iterators replace the loop
itself with a value representing "the next step of the computation,"
computed only when asked for.

1. An accumulating loop is a small, bounded, single-threaded instance of
   shared mutable state — safer than the concurrent case, not exempt from
   the pattern.
2. The counter and the accumulator are each a second thing to get right,
   separate from the logic of what's being computed.
3. Order-independence (`sum` doesn't care what order you add in) is a fact
   about the operation, not something the loop's syntax expresses.
4. The next three lessons are three different answers to "what if the
   running total didn't live in a mutable variable at all."
