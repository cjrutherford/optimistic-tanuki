# What "Immutable" Actually Freezes

"Immutable" sounds like one guarantee. It is at least three, and they freeze
different things: the name, the value, and the structure holding many values.
Mixing them up is how you end up surprised that a `const` array in
JavaScript can grow.

---

## Guarantee One: The Binding Doesn't Move

This is the weakest of the three, and it's what most languages mean when
they let you mark a variable as unchangeable.

```javascript
const arr = [1, 2, 3];
arr = [4, 5, 6]; // TypeError: Assignment to constant variable.

arr.push(4); // fine — arr still [1, 2, 3, 4]
console.log(arr); // [1, 2, 3, 4]
```

`const` in JavaScript freezes the label, not the box. `arr` can never be
made to point at a different array (that's what the error on line two is
enforcing), but nothing stops you from reaching into the array `arr` still
points at and changing its contents. This is the same rebinding-versus-
mutation split from the previous lesson, and `const` only locks the
rebinding half.

TypeScript's `readonly number[]` locks a different half again: it stops the
_compiler_ from letting you call mutating array methods through that
particular typed reference, which is a type-system guarantee, not a runtime
one. `apps/learning-service/src/assets/content/letsgots/modules/basics/02-variables-types.md`
shows `readonly number[]` next to plain `const`, and the TypeScript course's
type-system module goes further into what the type checker will and won't
stop.

---

## Guarantee Two: The Value Itself Cannot Change

This is stronger, and it's a property of the _value's type_, not of any
particular variable holding it.

A number, a string, or a Python tuple can't be mutated at all: there's no
method or operation that changes one in place. Every "change" you write is
actually guarantee-one plus guarantee-three sleight of hand: it builds a new
value and rebinds the name to it.

```python
s = "hello"
s += " world"   # does not mutate the string "hello" —
                # builds "hello world" and rebinds s to it
```

If some other name still pointed at the original string, it would see
`"hello"`, unchanged, forever. That's the whole guarantee: no code path,
anywhere, can reach into that string and edit a character. Immutable value
types make guarantee three moot for that particular value: there's nothing
to protect against, because in-place change was never on the menu.

---

## Guarantee Three: Nothing Downstream Can Observe a Change

This is the strongest guarantee and the one people usually mean by "truly
immutable data." A persistent (or "immutable") collection promises that
_every_ operation that looks like a mutation actually returns a new
collection, leaving the original fully intact and observable by anyone still
holding it, no matter how deep the structure goes.

```javascript
// A persistent list library, not a plain JS array:
const original = List.of(1, 2, 3);
const updated = original.push(4);

console.log(original.toArray()); // [1, 2, 3] — untouched
console.log(updated.toArray()); // [1, 2, 3, 4] — a distinct value
```

The plain-array version at the top of this lesson could not make this
promise: `arr.push(4)` mutates in place and every other name pointing at
`arr` sees the new element. A persistent collection is engineered
specifically so that operation is impossible: `push` can only return a new
structure, never touch the old one, no matter who else is holding a
reference to it.

---

## Where Rust Sits, and Why It's Different From All Three

Rust's plain (non-`mut`) binding looks, at first glance, like guarantee one:
a `let` without `mut` can't be reassigned, the same as JavaScript `const`:

```rust
let v = vec![1, 2, 3];
// v = vec![4, 5, 6];   // error: cannot assign twice to immutable variable
```

But unlike JavaScript's `const`, a non-`mut` Rust binding also blocks
mutation through that name. There's no equivalent of `arr.push(4)` slipping past it:

```rust
let v = vec![1, 2, 3];
// v.push(4);   // error: cannot borrow `v` as mutable, as it is not declared as mutable
```

This isn't guarantee two: `Vec<i32>` is a genuinely mutable type, and a
`mut` binding to the same vector can push into it freely. It also isn't
guarantee three: nothing here is a persistent structure, and there's no
promise that _other_ code holding a `&mut` reference can't change it. What
Rust gives you is guarantee one, extended to cover every path of mutation
that goes through _this particular name_, checked at compile time. For
owned, non-aliased data, that closes exactly the gap JavaScript's `const`
leaves open. `apps/learning-service/src/assets/content/letsgorust/modules/basics/02-variables-types.md`
introduces `let` versus `let mut`, and the ownership module explains why the
compiler is able to make this promise stick, because for a given owned
value, it knows statically whether a mutable path to it exists at all.

---

## The Same Split Inside a Struct

The three guarantees don't just apply to a single variable; they nest
inside composite values too, and that's usually where "but I marked it
`const`" surprises show up in practice.

```javascript
const config = { retries: 3, tags: ['a', 'b'] };

config = { retries: 5 }; // TypeError — the binding is frozen
config.retries = 5; // fine — the object itself is not frozen
config.tags.push('c'); // also fine — nesting doesn't inherit const-ness
```

`const` only ever freezes the one binding it's attached to: `config`
itself can't be pointed elsewhere. It says nothing about `config`'s fields,
and nothing at all about values nested further inside, like `tags`. Getting
guarantee three for a nested structure means reaching for `Object.freeze`,
or a persistent-collection library, deliberately: it's never a side effect
of `const` alone, no matter how deep the object graph goes.

---

## Telling the Three Apart

When someone says "immutable," ask which of these they mean:

1. **Binding-immutable**: the name can't be pointed elsewhere. `const` in
   JavaScript, `final` in Java. The value behind it may still change shape.
2. **Value-immutable**: the type itself has no mutating operations. Numbers,
   strings in most languages, tuples in Python. There is nothing to protect
   because there is no way to reach in and edit.
3. **Structurally persistent**: every apparent mutation returns a new
   structure, and old references stay valid and unchanged forever. This is a
   property of a specific data structure design, not a keyword.

Rust's non-`mut` binding is its own fourth thing worth naming separately: a
compile-time guarantee that no mutation reaches an owned value through any
name at all, for as long as that binding exists unshadowed. It borrows the
shape of guarantee one and delivers strength closer to guarantee two, and it
can do that specifically because ownership makes "does another mutable path
exist" a question the compiler can answer for certain, which is exactly
where the next lesson is headed.
