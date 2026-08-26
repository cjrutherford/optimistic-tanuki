# An Iterator Is Not a List

Everything in this module so far has been about how to walk through a
sequence: a loop's mutable counter, a recursive call's arguments, the
question of whether that recursion costs a stack frame. An iterator is a
different answer to a related but separate question: not "how do I walk
through this sequence" but "what _is_ a partially-walked sequence, as a
value I can hold, pass around, and not yet finish."

The short version: an iterator is a suspended computation. It knows how to
produce the next element, on demand, and nothing more happens until
something asks.

---

## The Shape of an Iterator

Rust makes the definition unusually explicit, because it's expressed as an
ordinary trait rather than built into the language as special syntax. The
Rust course's collections material,
`letsgorust/modules/collections/03-iterators.md`, gives the trait directly:

```rust
trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
}
```

That's the entire contract: something you can repeatedly ask "what's next,"
which answers with either `Some(item)` or `None` when it's exhausted. There
is no method for "give me everything." An iterator doesn't hold a sequence:
it holds _enough state to produce the next element_, and produces exactly
one element per `next()` call, whenever it's called, however far apart in
time those calls happen to be.

That's the whole difference from a list. A `Vec<i32>` or a Go `[]int` is a
sequence that already exists, in full, in memory: every element is already
there before you touch it. An iterator over that same data might not have
computed a single element yet.

---

## Laziness: Nothing Runs Until Something Consumes

The same Rust lesson is explicit that adapters like `map` and `filter` are
evaluated lazily: building an adapter chain does not walk the data; it
builds a description of what walking the data would do, and that
description only executes when something finally asks for values one at a
time.

```rust
let v = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

let result: Vec<i32> = v.iter()
    .filter(|&&x| x % 2 == 0)
    .map(|&x| x * x)
    .collect();  // [4, 16, 36, 64, 100]
```

The `filter(...)` call does not filter anything the moment it runs. It
returns a new iterator value, one that, when asked for its next element,
will ask _its_ inner iterator for elements and discard the odd ones until it
finds an even one to hand back. `map(...)` does the same: it returns an
iterator that, when asked, pulls one value from `filter`'s iterator and
squares it. Nothing walks the original vector until `collect()`, the
consuming call, starts asking each stage in the chain, one at a time, for
its next value.

This matters for more than performance, though it does matter for
performance: chaining `filter` and `map` over a ten-million-element
collection, then calling `.take(3)`, only ever computes three elements'
worth of work through the whole chain, because nothing downstream ever asks
for a fourth. A version built on lists instead of iterators (filter the
whole thing into a new list, then map the whole thing into another new
list, then take three) would have done all ten million filter checks and
all ten million multiplications before throwing away everything but three
answers.

---

## The Same Shape, Different Vocabulary

The underlying idea, "the next element" as a request rather than "the
elements" as a stored collection, recurs everywhere, described differently
depending on the language:

- Iterators built from generator functions (`function*` and `yield` in
  TypeScript/JavaScript) make the suspension explicit in the syntax: a
  generator function's body pauses at `yield` and resumes exactly where it
  left off the next time it's asked for a value. That pause-and-resume is
  the mechanism; Rust's `Iterator::next()` achieves the same effect without
  needing the function itself to literally pause, because each call to
  `next()` starts a fresh, ordinary function call that reads whatever state
  the iterator saved from before.
- A Go channel used as a producer (a goroutine sending values one at a
  time, a consumer ranging over the channel) is the same suspended-
  computation idea again: the producer only computes the next value once
  the consumer is ready to receive it (or up to the channel's buffer size
  ahead of that), rather than computing everything up front.
- C++'s standard algorithms operating on iterator pairs (`begin()`,
  `end()`) walk a range one step at a time via `operator++`, and a chain of
  range adapters over that pair defers work in the same spirit, though the
  exact laziness guarantees depend on which adapters and which standard
  library version.

The vocabulary differs (trait, generator, channel, iterator pair), but the
question each answers is the same one: what does it mean to have "the rest
of a sequence" as a value, without having computed any of it yet.

---

## Why This Belongs at the End of the Module

Every earlier lesson in this module removed one thing from a `for` loop.
Recursion removed the mutable accumulator. Tail calls asked whether removing
the loop's stack behavior was safe to assume (it isn't, here). An iterator
removes something more basic: the assumption that "the sequence" is a thing
that already fully exists. It reframes a sequence as a value that describes
_how to keep producing elements_, decoupling "define the computation" from
"run the computation," the same separation the first lesson in the functions
module drew between a function's declared type and what it actually does
when called, except here it's a whole pipeline of steps, not just one
function, that stays inert until something finally pulls a value through it.

1. An iterator is a suspended, resumable computation that produces one
   element per request, not a container holding all its elements already.
2. Adapters like `map` and `filter` build new iterators; they do not touch
   the underlying data until a consuming operation starts pulling values.
3. Laziness lets a chain ending in `.take(n)` do proportionally less work
   than building intermediate lists at every stage would require.
4. The same suspended-computation idea appears as generators, channels, and
   iterator-pair ranges elsewhere: different vocabulary, same underlying
   question of when work actually happens.
