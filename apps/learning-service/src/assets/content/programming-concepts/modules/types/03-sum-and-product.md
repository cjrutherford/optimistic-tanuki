# One Of These, or All of These

Every composite type you've ever written is built from two combinators, and
only two: "this value has all of these fields at once" or "this value is
exactly one of these possibilities." Knowing which one you're reaching for,
and reaching for the right one on purpose, is how a type stops representing
invalid states rather than just documenting valid ones.

---

## Product Types: All of These, Together

A struct, a class with fields, a tuple (anything where a value carries
every one of several pieces of data simultaneously) is a product type. The
name comes from counting: if a field can hold any of `m` values and another
can hold any of `n`, the whole struct can hold `m × n` combinations, because
every value of the first field can be paired with every value of the second.

```go
type Rectangle struct {
    Width  float64
    Height float64
}
```

A `Rectangle` always has both a `Width` and a `Height`. There is no
`Rectangle` value that has one without the other. `apps/learning-service/src/assets/content/letsgogo/modules/basics/06-structs.md`
covers structs as Go's version of this, including that assigning one
copies both fields together, which is a direct consequence of the value
being genuinely one thing made of two parts, not two independent things
loosely associated.

Product types are the natural fit whenever a value genuinely needs several
pieces of information at once, and every everyday "record" or "row" you've
modeled is one.

---

## Sum Types: Exactly One of These

A sum type says a value is exactly one of several distinct possibilities,
never more than one, and, this is the part that does the real work, the
possibilities don't all have to carry the same data.

```rust
enum Message {
    Quit,                      // no data
    Move { x: i32, y: i32 },   // struct-like
    Write(String),             // tuple-like
    ChangeColor(u8, u8, u8),   // tuple-like with multiple values
}
```

A `Message` value is a `Quit`, or a `Move`, or a `Write`, or a `ChangeColor`
, never a blend, never two at once. Each variant carries only the data that
variant needs: `Quit` carries nothing, `Move` carries an `x` and a `y`,
`Write` carries a single `String`. `apps/learning-service/src/assets/content/letsgorust/modules/structs/02-enums.md`
walks through declaring exactly this enum and matching on it, and the
counting name applies here too: a `Message` can be any one of 4 shapes, so
this type has (roughly) the _sum_ of each variant's own possibilities,
rather than their product.

TypeScript reaches the same place with union types instead of an `enum`
keyword:

```typescript
type NetworkState = { status: 'loading' } | { status: 'success'; data: string[] } | { status: 'error'; error: Error };
```

A `NetworkState` is exactly one of these three object shapes, discriminated
by `status`. `apps/learning-service/src/assets/content/letsgots/modules/type-system/02-union-intersection.md`
covers this pattern (a discriminated union) and pairs it with intersection
types (`&`), which are TypeScript's product combinator: "has all the fields
of `A` and all the fields of `B`." Union is "one of," intersection is "all
of," which is the sum/product split under TypeScript's own names.

---

## Why the Difference Prevents a Bug Class

Here's the concrete payoff. Model a network request's state as a product
type (a struct with an optional field for each possible piece of data)
and you get combinations the domain never actually allows:

```typescript
// Product-shaped: has a slot for every field, always.
interface NetworkStateBad {
  loading: boolean;
  data?: string[];
  error?: Error;
}
```

Nothing stops `{ loading: true, data: [...], error: new Error() }` from
existing: loading _and_ holding data _and_ holding an error, all at once,
a combination that should never occur but that the type happily allows.
Every function reading this value has to defensively check combinations
that shouldn't be possible, because the type made them representable
anyway.

The sum-typed `NetworkState` from above rules this out structurally. A value
is `{ status: 'loading' }`, or it's the success shape with `data`, or it's
the error shape with `error`; there is no fourth shape where two of those
are true simultaneously, because a sum type's whole definition is that a
value is exactly one variant, not a combination. The invalid states aren't
handled or checked against: they're simply not values the type can hold.
This is the concrete meaning of the phrase "make invalid states
unrepresentable": not a discipline you have to maintain by checking
carefully, but a fact about which values compile at all.

Rust's `Option<T>` is the standard-library example of the same trick applied
to a much smaller problem, null:

```rust
enum Option<T> {
    Some(T),
    None,
}
```

There is no state where a value is simultaneously "absent" and "holds a
`T`." Compare that to a language where every reference type can be null
regardless of its declared type: there, _every_ value of type `T` secretly
has this same extra possibility bolted on, unchecked by the type, and every
caller has to remember to check for it by convention rather than have the
type force the check.

---

## Pattern Matching Is What Reading a Sum Type Looks Like

A sum type is only half the idea: the other half is that the language
forces you to handle every variant when you read one back out. Rust's
`match` on the `Message` enum from earlier is exhaustive: leave out a
variant and the compiler refuses to build the program.

```rust
fn handle(msg: Message) -> String {
    match msg {
        Message::Quit => "quitting".to_string(),
        Message::Move { x, y } => format!("moving to ({x}, {y})"),
        Message::Write(text) => format!("writing: {text}"),
        // ChangeColor omitted
    }
}
// error[E0004]: non-exhaustive patterns: `Message::ChangeColor(_, _, _)` not covered
```

This is the payoff completing itself: it isn't enough that invalid _states_
can't be constructed; the compiler also guarantees every valid state gets
handled somewhere, so adding a new variant later surfaces every place that
needs updating, as a compile error, rather than as a runtime surprise the
first time that variant actually shows up.

---

## Recognizing Which One You Need

The question to ask when reaching for a struct or an enum: does this value
need _all_ of these pieces of data at once, or is it _exactly one_ of
several distinct possibilities that might not even share the same fields?

1. If every instance genuinely carries all the fields together, it's a
   product type: a struct, a class, a tuple.
2. If an instance is one of several distinct, mutually exclusive shapes,
   especially if the shapes carry different data, it's a sum type, and
   modeling it as a struct with a pile of optional fields is where the
   "impossible" combinations creep back in.
3. Most real designs are products of sums, or sums of products: a `Message`
   variant that itself has multiple fields is a product nested inside a sum,
   and getting comfortable naming which combinator you're using at each
   level is what makes a complex type easy to read instead of a guessing
   game.
