# Composing Instead of Inheriting

There are two ways to build a bigger piece of behaviour out of smaller ones.
One is to extend: start from a base and add or override. The other is to
combine: take small, independent pieces and wire them together. Object
inheritance is the first. Function composition and narrow interfaces are the
second. This module has been building toward the second the whole time:
first-class functions and closures are the raw material composition is made
of.

None of the four languages behind this course center inheritance as the
default way to build behaviour, and that's not an accident of taste. It's
worth understanding why.

---

## What Composition Looks Like

Composing functions means feeding the output of one into the input of the
next, and treating the combination as a new function in its own right.

```ts
const trim = (s: string) => s.trim();
const lower = (s: string) => s.toLowerCase();
const slugify = (s: string) => s.replace(/\s+/g, '-');

const normalize = (s: string) => slugify(lower(trim(s)));

normalize('  Hello World  '); // "hello-world"
```

`normalize` isn't a new algorithm. It's three small, independently
understandable, independently testable functions, glued in a fixed order.
Each of `trim`, `lower`, and `slugify` can be tested with one input and one
expected output, in isolation, and `normalize`'s own test only needs to check
that the glue is right; the individual steps are already proven.

```go
func normalize(s string) string {
    return slugify(strings.ToLower(strings.TrimSpace(s)))
}
```

Same shape in Go, spelled without a pipeline operator: functions nested
inside each other, each one narrow.

---

## What Inheritance Optimizes For, and What It Costs

Inheritance is a good fit when there really is an "is-a" relationship that
holds permanently and unambiguously: a `Dog` is always an `Animal`, in every
context, forever. The Go course is explicit that Go itself declines to offer
this tool: `letsgogo/modules/basics/06-structs.md` covers embedding as the
closest Go gets, and is careful to say what embedding is _not_:

> This is composition, not inheritance. `Dog` is not a subtype of `Animal`:
> you cannot pass a `Dog` to a function expecting an `Animal`.

That line is the whole argument in miniature. Embedding gives you the
fields and methods, promoted onto the outer type, without creating a
subtyping relationship you'd then have to reason about at every call site
that accepts an `Animal`. Rust makes the same choice even more starkly: it
has no struct inheritance at all. Behaviour is shared through traits
(narrow interfaces a type opts into) and through composition of smaller
types as fields, never through extending a base struct.

The classic failure mode of deep inheritance hierarchies is that "is-a" stops
being true cleanly the moment a hierarchy grows past two or three levels. A
`Penguin` is a `Bird`, and `Bird` has a `fly()` method, and now every bird in
the system either has to fly or override `fly()` to fail loudly. The
hierarchy forced a decision that a `Penguin` and an `Eagle` sharing a
`Bird` base didn't actually agree on. Composition never has this problem
because nothing is implicitly inherited; every capability a type has is one
it was explicitly given, usually as a field or a trait implementation.

---

## Narrow Interfaces Instead of Wide Base Classes

The other half of "compose instead of inherit" is: describe what you need in
the smallest possible interface, rather than depending on a large, specific
type.

```go
type Writer interface {
    Write(p []byte) (n int, err error)
}

func logTo(w Writer, msg string) {
    w.Write([]byte(msg))
}
```

`logTo` doesn't ask for a `*os.File` or a `*bytes.Buffer`: it asks for
anything with a `Write` method, and a file, an in-memory buffer, a network
connection, and a test double all qualify without declaring any relationship
to each other or to `logTo` in advance. Go's interfaces are satisfied
implicitly: a type is a `Writer` because its methods match, not because it
said `implements Writer` anywhere. Rust's traits work the same way in
spirit, if not in mechanism: `impl Write for MyType` is explicit, but the
trait itself stays narrow, and a function taking `impl Write` or `&dyn
Write` accepts anything that satisfies it, with no shared ancestor required.

This is the interface-side version of the same idea as composing functions:
build the small, reusable unit, one function, one narrow interface, and
let combination, not extension, produce the larger behaviour.

---

## Composition of Functions Is Composition of Behaviour

Tie this back to the first two lessons in this module. A pure function with
an honest signature (lesson 1) is easy to compose because there's nothing
hidden that the composition might disturb. A function passed as a value
(lesson 2) can be composed at runtime, not just written once at compile
time: `sortBy` from that lesson composes a generic sort with whatever
`less` function the caller supplies, which is functional composition wearing
a higher-order-function costume.

```rust
fn compose<A, B, C>(f: impl Fn(A) -> B, g: impl Fn(B) -> C) -> impl Fn(A) -> C {
    move |x| g(f(x))
}

let shout = compose(|s: String| s.to_uppercase(), |s: String| format!("{}!", s));
shout("hello".to_string()); // "HELLO!"
```

`compose` is a function that builds a new function out of two others: a
closure (lesson 3) that captured `f` and `g` to use later. Nothing here is
language-specific; it's the same three ideas (functions as values,
closures capturing what they need, small pieces glued rather than a
hierarchy extended) recombined.

---

## When to Reach for Which

Composition doesn't make inheritance wrong everywhere it exists: it makes
inheritance the tool you should be able to justify, not the default. A short
way to decide:

1. If the relationship is "does the same job as, in a way that varies," ask
   for a narrow interface or trait, not a shared base class.
2. If the relationship is "is built out of," use a field (composition),
   not embedding for its own sake.
3. If the behaviour is "run these steps in order, each one replaceable,"
   compose functions rather than overriding methods in a subclass.
4. Reach for actual inheritance only when the "is-a" relationship is
   permanent, unambiguous, and unlikely to need an exception two years from
   now, which is rarer than it feels while designing the first version.
