# When a Signature Tells the Truth

A function has two interfaces. The first is the one the compiler checks: the
parameter types and the return type. The second is unwritten: everything else
the function does while it runs: the file it reads, the global it mutates,
the request it fires over the network, the random number it draws. Call that
second interface its _effects_.

Most languages let the first interface lie about the second. This lesson is
about learning to notice the lie, because every one of the four language
courses this course sits underneath spends real time on it, under different
names.

---

## The Same Name, Two Meanings

Take a function that looks identical in outline across languages:

```go
func total(items []Item) int {
    sum := 0
    for _, it := range items {
        sum += it.Price
    }
    return sum
}
```

```rust
fn total(items: &[Item]) -> i32 {
    items.iter().map(|it| it.price).sum()
}
```

Nothing here reaches outside its own arguments. Give it the same slice twice
and it returns the same number twice, forever. It allocates no state that
outlives the call, and it changes nothing the caller didn't hand it explicitly
(and in the Go version, not even that: `items` is read, not written).

That is a _pure_ function: its output is a function, in the mathematical
sense, of its input, and its only effect is computing a return value. Compare:

```go
func total(items []Item) int {
    sum := 0
    for _, it := range items {
        sum += it.Price
        logToAnalytics(it) // <-- network call, hidden
    }
    globalRunningTotal += sum // <-- mutates package state, hidden
    return sum
}
```

Same signature. `func([]Item) int`. A caller reading the type has no way to
know that calling this function twice sends two network requests and moves a
package-level counter. The signature told the truth about the shape of the
data and said nothing about the shape of the consequences.

---

## Why This Is Worth a Whole Lesson

"Just don't do that" is not an answer, because side effects are not optional
in real programs: something has to write to the database, something has to
print to the screen. The discipline is not eliminating effects. It's refusing
to let them hide.

Three concrete costs of a hidden effect:

**Testing.** A pure `total` is tested by calling it with a slice and checking
a number. A `total` that also calls `logToAnalytics` either needs that
function stubbed out, or your test suite silently makes real network calls.
The second interface leaked into your test infrastructure.

**Reordering and reuse.** A pure function can be called zero times, once, or
a thousand times, in any order, from any thread, and the only thing that
changes is how many return values you collect. A function with hidden state
mutation cannot be reordered against other callers of the same state without
thinking hard about what "before" and "after" mean. This is the entire reason
the parallelism material in the Go course (see
`letsgogo/modules/parallelism/03-race-conditions.md`) spends a whole lesson
on unsynchronized access to a shared `counter`: that lesson is this lesson,
applied to concurrent callers instead of sequential ones.

**Reasoning at a distance.** To know what `total(items)` does, a pure version
requires reading exactly one function. The effectful version requires reading
`total`, then `logToAnalytics`, then knowing that `globalRunningTotal` exists
and who else touches it. The signature promised you one function's worth of
reading and delivered three.

---

## Where the Type System Helps and Where It Doesn't

Some languages narrow the gap between the two interfaces. Rust's borrow
checker forces a function that mutates something the caller owns to say so in
the signature: `fn total(items: &mut [Item])` versus `fn total(items:
&[Item])` is a real, compiler-checked difference, not a comment. A `&[Item]`
parameter is a signature you can trust not to mutate the slice.

But even Rust's signature says nothing about network calls, disk writes, or
printing: those are effects the type system doesn't track by default. Go and
C++ track even less: a `[]Item` parameter and a `std::vector<Item>&`
parameter both compile whether the function is pure or not. The signature's
honesty is a spectrum, not a binary, and no mainstream language in these
courses puts every effect in the type.

Which means the discipline has to be partly social, not just mechanical: name
functions that have effects so the name says so (`logAndTotal`, not `total`),
and keep the effect-free core as large as you can, pushing side effects to the
edges of a call graph rather than sprinkling them through it. That shape
(compute purely, then do exactly one effectful thing with the result) will
come back in the next lesson, because it's also why passing a function around
is different from passing a value around.

---

## Recognizing the Signature That Lies

A few questions to ask about any function before trusting its signature:

1. Does it read or write anything outside its parameters and locals: a
   global, a package-level variable, a field on `self`/`this` beyond what was
   passed in?
2. Does calling it twice with identical arguments risk two different
   answers, or two different amounts of damage?
3. Does it do I/O: network, disk, environment variables, the clock, random
   numbers, anywhere in its body, including in something it calls?
4. If you deleted every call to this function from the program, would
   anything change beyond the value it returned going unused?

A "yes" to any of these means the signature is incomplete. That's not
necessarily a bug (programs need effects), but it means the honest version
of the signature is the one in the docstring, not the one in the type, and you
should read the body before you trust the name.
