# Inferred Is Not Untyped

If your first language was JavaScript, or you learned typed languages after
years of untyped ones, there's a natural mistake waiting here: seeing a
variable declared without an explicit type annotation and assuming that
means the language isn't checking it. That's backwards. Inference is a
question of _how a type gets attached to a name_, whether you wrote it or
the compiler worked it out. It has nothing to do with _whether_ that type is
then enforced. Those are independent questions, and the first lesson in
this module already drew the line inference actually sits on: static versus
dynamic is about when a check happens, and inference only ever changes
_where the annotation came from_ within a language that was already
checking statically.

---

## What Inference Actually Does

Leave off a type annotation in a statically typed language with inference,
and the compiler doesn't skip the check: it works out what the type would
have been, from the value or expression on the other side of the `=`, and
proceeds exactly as if you'd written it yourself.

```rust
let x = 5;         // Rust infers i32
let y: f64 = 3.14; // written out explicitly
```

`x` and `y` are both fully typed by the time compilation finishes. `x` is
`i32` whether or not you wrote `i32` anywhere; the annotation on `y` didn't
make `y` "more checked" than `x`; it just wrote down, by hand, what
inference would have worked out on its own. `apps/learning-service/src/assets/content/letsgorust/modules/basics/02-variables-types.md`
introduces exactly this: Rust as "a statically typed language with powerful
type inference," which is precise phrasing worth taking literally: static
typing is the property being checked; inference is the mechanism filling in
what you didn't write.

TypeScript makes the same claim in its own terms:

```typescript
const message = 'Hello'; // TypeScript infers: string
const count = 42; // TypeScript infers: number
```

`apps/learning-service/src/assets/content/letsgots/modules/javascript-to-typescript/02-type-inference.md`
lists exactly where TypeScript pulls an inferred type from: initializers,
return statements, default parameters, and the surrounding call-site context
for a callback, and every one of those is a compile-time source. None of
them involve waiting to see what value actually shows up while the program
runs.

---

## Proving It: Try to Violate an Inferred Type

If inference genuinely skipped enforcement, this would be allowed. It
isn't, in either language:

```rust
// mut, so that the only thing wrong here is the type. A plain `let` binding
// cannot be reassigned at all, which would fail for a second reason and
// muddy the point being made.
let mut x = 5;  // inferred as i32
x = "hello";    // error[E0308]: mismatched types, expected `i32`, found `&str`
```

```typescript
const message = 'Hello'; // inferred as string
// message is const, so try a mutable version:
let msg = 'Hello'; // inferred as string
msg = 42; // error TS2322: Type 'number' is not assignable to type 'string'.
```

Both of these fail at compile time, before anything runs, with exactly the
same category of error you'd get if the type had been written explicitly
and violated. The compiler is enforcing the inferred type with the same
force as a written one, because as far as the type checker is concerned,
there is no difference between the two once inference has run: the
annotation you skipped writing has already been filled in and is now just
as binding as if you'd typed it.

---

## The JavaScript Habit That Causes the Confusion

The mix-up has a specific, identifiable source. In JavaScript, a variable's
type genuinely can change over its lifetime, because JavaScript is
dynamically typed: the type lives on the value, not the name, and
reassigning the name to a different kind of value is completely ordinary:

```javascript
let value = 'hello';
value = 42; // totally fine — value's type tracks whatever it holds right now
```

Seeing `let x = 5` with no annotation in Rust or TypeScript and pattern-
matching it against this JavaScript habit is exactly backwards. In
JavaScript, no annotation was ever possible for `let value = 'hello'` in the
first place: there's no static type slot to have filled in, inferred or
otherwise, because the language isn't checking one before the program runs.
In Rust or TypeScript, the annotation was optional to _write_, not optional
to _have_. `apps/learning-service/src/assets/content/letsgots/modules/basics/02-variables-types.md`
addresses this directly for `let` versus `const` widening, and it's worth
noticing that even that widening (`let` inferring the general `string`
rather than the narrow literal `"hello"`) is still a single, fixed,
statically-checked type decided once at the declaration and enforced from
then on. It is not TypeScript leaving the door open the way JavaScript does.

---

## Where This Actually Changes How You Write Code

Recognizing that inference is a writing convenience, not a safety trade-off,
changes what you reach for an explicit annotation for. You don't add one to
get more checking. You already have that. You add one when the compiler
can't work out what you meant on its own, or when a human reading the code
later needs the type spelled out even though the compiler doesn't:

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

A function's parameters need annotations because there's no initializer to
infer from: nothing about `name` alone tells the compiler what type a
_caller_ is going to pass. This isn't a case where inference "isn't safe
enough here"; it's a case where inference has no source to draw a type from
at all, so the language requires you to state one.

---

## Inference Can Still Be Wrong to Rely On

None of this means inference is always the right call to make. It can infer
a type that's technically correct but wider than you wanted:

```typescript
const colors = ['red', 'green', 'blue'];
// inferred as string[] — any string could be pushed in later, and would type-check
```

`colors` is fully, statically typed here: `string[]`, checked, enforced.
The catch is that `string[]` is a wider promise than "exactly these three
strings, in this order," which is probably what was meant. TypeScript still
enforces whatever it inferred; the fix, when the narrower type is what you
actually want, is to say so:

```typescript
const colors = ['red', 'green', 'blue'] as const;
// type: readonly ["red", "green", "blue"]
```

This isn't inference failing to check something. It's inference correctly
working out the most general type that fits, and you overriding it with a
more specific promise. The distinction from this lesson still holds: both
versions are static, both are enforced, and the only thing that changed is
which type got attached.

1. Inference decides _where an annotation came from_: hand-written or
   worked out by the compiler, never _whether_ the resulting type is
   checked.
2. A variable with an inferred type is exactly as strictly typed, and fails
   exactly the same way when misused, as one with an explicit annotation.
3. The JavaScript instinct that an un-annotated variable can hold anything
   is a fact about dynamic typing, not about inference, and it does not
   carry over to a statically typed language just because the annotation
   was left off.
