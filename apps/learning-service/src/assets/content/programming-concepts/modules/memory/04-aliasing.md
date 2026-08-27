# Two Names for the Same Memory

Aliasing is what you get whenever two names can reach the same memory at
the same time. It is not a bug by itself (sharing is often exactly what you
want) but it is the single mechanism behind three problems that look
unrelated until you name it: Go's slice-sharing surprise, C++'s dangling
pointer, and the entire reason Rust's borrow checker exists.

---

## The Mechanism, Stated Once

Two names alias when they refer to the same underlying storage, so a write
through one is visible through the other, and (this is the dangerous
half) a write through one can also invalidate what the other one is
looking at.

```
a ──┐
    ├──> [same memory]
b ──┘

b writes here → a sees the write, because a and b were never separate
```

Every language gives you ways to create aliases on purpose: a reference in
JavaScript, a pointer in C++, a slice header in Go, a `&` borrow in Rust.
The differences between languages are about what happens _after_ the alias
exists: whether the language lets an alias outlive what it points to,
whether it lets you mutate through one alias while another is reading, and
whether it catches either mistake before your program runs.

---

## Go's Version: Aliasing You Didn't Ask For

A Go slice is a small struct (a pointer, a length, a capacity) and copying
a slice copies that struct, not the array it points at. Two slices with
different headers can still alias the same backing array.

```go
a := []int{1, 2, 3}
b := a          // b is NOT a copy of the data — it's a new header
                // pointing at the same backing array
b[0] = 99
fmt.Println(a[0]) // 99 — a sees the write, because a and b share memory
```

`letsgogo/modules/quirks/02-slices-arrays-maps.md` calls this out directly
as the slice reference trap and gives the fix (copy the data explicitly
with `make` and `copy`) but the reason it's a _trap_ rather than a feature
is that nothing in `b := a` looks like it's creating an alias. It looks
like every other assignment in the language. This is aliasing with no
visible marker at the call site, which is exactly why it surprises people:
the mechanism is identical to a C++ reference, but C++ makes you write `&`
to get one.

---

## C++'s Version: An Alias That Outlives Its Target

C++ lets you create a pointer or reference to something and places no limit
on how long you keep it, including past the point where the thing it points
to stops existing. The alias itself doesn't disappear: it just starts
pointing at memory nothing owns anymore.

```cpp
int* p = new int(42);
delete p;
*p = 10;   // undefined behavior — p still names the address,
           // but nothing at that address is valid anymore
```

This is the same "two names, one memory" shape as the Go example, with the
danger moved to a different moment: Go's problem is an alias mutating shared
data unexpectedly _while both names are still valid_; C++'s dangling
pointer is an alias outliving the validity of what it names. Both are
consequences of the same fact: a name and the memory it refers to are not
the same thing, and nothing forces them to have matching lifetimes unless a
language builds that check in.

---

## Rust's Version: Aliasing Checked at Compile Time

Rust's borrow checker exists because aliasing plus mutation is where the
first two examples' bugs come from, and Rust tries to rule both out before
the program runs rather than after. The rule: at any moment, a value may
have either one mutable reference or any number of immutable ones, never
both kinds at once.

```rust
let mut s = String::from("hello");

let r1 = &s;      // immutable borrow — fine
let r2 = &s;      // a second immutable borrow — also fine, reading doesn't conflict
// let r3 = &mut s; // ERROR: cannot borrow as mutable while r1, r2 are alive
```

Read the error as a direct answer to the Go example: `b := a` and `b[0] = 99`
is "alias, then mutate through the alias while another name is watching."
Rust's compiler refuses to compile the shape that lets that happen: not
because mutation or aliasing are individually forbidden, but because _both
at once, through two live names,_ is precisely the situation that produced
the Go surprise and, in a different way, the C++ dangling pointer. Rust's
second rule, that references must always be valid, rules out the C++ case
too: a reference cannot outlive the value it borrows from, checked at
compile time instead of discovered at runtime as undefined behavior.
`letsgorust/modules/ownership/02-borrowing.md` covers both rules together,
including the mutable-reference example this section leans on.

---

## Naming the Mechanism Before You Meet the Symptom

None of these three languages invented a new problem. They inherited the
same one (two names, one piece of memory, one of them mutates) and made a
different choice about when you find out:

1. **Go**: aliasing is silent and pervasive for slices and maps; you find
   out at runtime, if you notice the value changed somewhere you didn't
   expect
2. **C++**: aliasing is explicit at creation (`&`, `*`) but unchecked
   afterward; you find out at runtime, often as undefined behavior with no
   error message at all
3. **Rust**: aliasing is explicit and checked continuously; you find out at
   compile time, before the program runs

Once you can recognize "these are two names for one thing" as the shared
shape, a borrow-checker error stops reading as an alien Rust-specific rule
and starts reading as the same bug category Go and C++ let through, caught
earlier.

---

## Sharing on Purpose

None of this makes aliasing a mistake to avoid outright: plenty of code
depends on it working correctly. Passing a large struct by pointer instead
of copying it, having two parts of a program observe the same in-memory
cache, or handing a callback a reference to state it should update, are all
aliasing used deliberately. The problem this lesson describes is never
"two names for one memory address" by itself; it's that mutation, aliasing
that outlives its target, or aliasing you didn't know you'd created are
where the three examples above actually went wrong. Once you're
deliberately sharing memory, the same question from every earlier lesson in
this module applies again: who is allowed to mutate through this alias, and
does every other name pointing at the same memory expect that.

---

## Best Practices

1. Before trusting that two variables are independent, ask whether either
   one is a reference, pointer, slice, or map (the types most likely to
   alias silently)
2. In Go, copy explicitly with `make` and `copy` when you need independent
   data, not just an independent header
3. In C++, never dereference a pointer after the thing it points to has
   been deleted or gone out of scope
4. In Rust, read a borrow-checker error as "two live names, one of them
   mutating" and look for which borrow should have ended sooner
