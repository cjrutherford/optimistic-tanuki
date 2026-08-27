# What a Type Is For

You've been writing types for however long you've been programming, and if
you learned one language well, you have a working feel for how they behave
in that language. What's easy to miss, staying inside one language, is what
a type is actually _for_: the job it's doing underneath the syntax. That
job splits into two genuinely different strategies, and every language you
meet from here on picks one, the other, or some blend, and the differences
between languages that feel arbitrary usually trace back to this choice.

---

## A Type Is a Promise, Checked at Some Point

Strip away keywords and a type is a claim about a value: "this is a string,"
"this is a `User`," "this holds one of these three variants." The
interesting question is never whether the language has that claim (nearly
all of them do, in some form). It's _when the claim gets checked_ and _what
happens if it's wrong_.

There are two points in a program's existence where a check can happen:
before it runs, by reading the source, or while it runs, by inspecting an
actual value in memory. Every language commits to doing this checking
predominantly at one of those two points, and that commitment is what
"statically typed" and "dynamically typed" actually mean.

---

## Static: The Promise Is Checked Before Anything Runs

A statically typed language reads your whole program, works out what type
every expression must have, and refuses to produce a running program if any
of those types don't line up, before the first line of your code executes.

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b
}

add(3, "four");
// error[E0308]: mismatched types
//   expected `i32`, found `&str`
```

Nothing ran. There is no program to run. The compiler rejected this before
producing an executable at all. The type of every variable, every parameter,
every return value was checked against how it's used, across the whole
program, ahead of time. This is what "the type is a static promise" means:
the promise is verified once, exhaustively, and then the running program
never has to re-check it, because it's been proven to hold everywhere the
compiler could see.

C++ and Go make the identical commitment in their own syntax: a Go program
with `add(3, "four")` where `add` expects two `int`s fails to compile, full
stop, same as Rust.

---

## Dynamic: The Promise Is Checked When It Matters

A dynamically typed language instead attaches a type to a _value_, at
runtime, and checks types only at the moment an operation actually needs one
to make sense.

```python
def add(a, b):
    return a + b

add(3, "four")
# TypeError: unsupported operand type(s) for +: 'int' and 'str'
```

This program _did_ run. It got as far as evaluating `a + b`, and only there,
at the point where `+` needed to know what it was adding, did Python
check whether `int` plus `str` is a meaningful operation. If `add` had never
been called, or had only ever been called with two numbers, this mismatch
would never have surfaced at all. The type tag lives on the value `3` and
the value `"four"` individually, not on the parameter `a` or `b` as a
standing claim about every possible value that name could hold.

---

## The Trade Both Sides Are Making

Neither approach is strictly more "typed" than the other: Python values
absolutely have types, and a Python program raises real type errors. The
difference is entirely about _when_ the check happens and _how much of the
program_ gets checked as a result.

Static checking inspects every code path the compiler can see, including
ones that never execute on any particular run: that's why it can catch a
bug in error-handling code nobody has managed to trigger yet. The cost is
that the compiler has to be convinced up front, which sometimes means
writing more to satisfy it before anything runs at all.

Dynamic checking only ever inspects the code path that actually executes,
with the actual values that showed up. That's cheaper to get a first version
running, and it never blocks you from running something the checker
couldn't fully reason about. But a bug in a rarely-hit branch can sit
undiscovered until production finally takes that branch.

---

## A Second, Independent Axis: How Much the Language Bends the Rules

Static versus dynamic answers _when_ a type gets checked. It says nothing
about a second, separate question: when two different types meet, does the
language quietly convert one to make the operation work, or does it refuse?
That's usually called "strong" versus "weak" typing, and it's worth keeping
mentally separate from the static/dynamic axis, because languages combine
these two properties in all four ways.

```javascript
// JavaScript: dynamically typed, and weakly typed — it coerces rather than refuses.
console.log(1 + '2'); // "12" — the number was silently converted to a string
console.log('5' - 1); // 4  — this time the string was converted to a number
```

```python
# Python: dynamically typed, but strongly typed — no silent coercion.
1 + '2'
# TypeError: unsupported operand type(s) for +: 'int' and 'str'
```

Both of these languages check types at runtime, not before: that's the
static/dynamic axis, and both land on the dynamic side of it. But they make
opposite choices about what happens when types disagree: JavaScript looks
for a way to make the operation succeed anyway, Python raises immediately.
That's a second, independent decision, layered on top of the first one.

Statically typed languages mostly forbid this kind of silent coercion too:
Go and Rust both refuse to add an `int` and a `string` without an explicit
conversion, but the two axes remain conceptually distinct even when a
particular language happens to land on the strict side of both.

---

## Why This Is the Foundation for Everything Else in This Module

The lessons that follow (nominal versus structural typing, sum and product
types, the two things people call polymorphism, and what inference actually
does) are all, underneath, refinements of this one question: _when is a
promise about a value's shape checked, and by what mechanism._

Type inference, in particular, gets confused with dynamic typing constantly,
and it shouldn't be: inference is about _how_ a static promise gets
written down, not about _whether_ it's checked, and the last lesson in this
module deals with that mix-up directly. Keep this lesson's frame in mind
going forward:

1. Every type is a promise about a value's shape or behavior.
2. The promise is checked either statically, before the program runs, or
   dynamically, while it runs, and that choice is a property of the
   language, not of any single value.
3. "Statically typed" and "strongly typed" are independent questions; this
   lesson is only about the first one, and later lessons build on it rather
   than repeat it.
