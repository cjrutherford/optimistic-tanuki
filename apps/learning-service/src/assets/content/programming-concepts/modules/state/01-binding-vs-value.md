# A Name Is Not the Value

You already know two different things can go wrong with a variable: you can
point it somewhere else, or you can change what's already there. Every
language you'll ever learn keeps this distinction, and most of them make you
guess which one an operation performs. Learning to ask "does this rebind the
name, or mutate the value?" before you read any further is the single most
useful habit this course can hand you.

---

## Two Separate Operations Wearing One Symbol

In most languages, `=` is used for both:

```python
x = [1, 2, 3]
x = [4, 5, 6]   # rebinding: x now points at a different list
x.append(7)     # mutation: the list x points at gets a new element
```

The first line makes `x` point at a fresh list. The old list `[1, 2, 3]`
still exists in memory for as long as anything else refers to it, but `x` no
longer does. The second line doesn't touch what `x` points at: it changes
the contents of the object `x` currently points at, in place.

If nothing else ever held a reference to `[1, 2, 3]`, the difference is
invisible from where you're standing. It stops being invisible the moment a
second name gets involved.

```python
a = [1, 2, 3]
b = a           # b and a name the same list
a = [4, 5, 6]   # rebinding a — b is unaffected, still [1, 2, 3]
b.append(7)     # mutation — a would see this too, if a still pointed at b's list
```

`a = [4, 5, 6]` changes what `a` points at. `b` was never consulted; it keeps
pointing at the original list. But `b.append(7)` changes the list itself, and
anything else that happened to point at that same list (including `a`,
before it was reassigned) would see the new element.

---

## A Concrete Picture

Think of a name as a label on a box, and a value as the box's contents. Two
labels can be stuck on the same box.

```
a ─┐
   ├──> [box: 1, 2, 3]
b ─┘

a = [4, 5, 6]      # a's label moves to a new box; b's label doesn't move

a ──> [box: 4, 5, 6]
b ──> [box: 1, 2, 3]

b.append(7)        # b's box gets new contents; a's box is untouched

a ──> [box: 4, 5, 6]
b ──> [box: 1, 2, 3, 7]
```

Reassignment moves a label. Mutation changes what's inside a box. They are
different operations, on different things, and confusing them is the source
of a specific, recurring class of bug: expecting a mutation to be visible
through a name that was reassigned away from that box, or expecting a
reassignment to be visible through a name that still points at the old box.

---

## Why This Split Shows Up Everywhere

Every language has to decide, for every operation, which of these two things
it does. Reassigning a variable never affects anyone else's view of the old
box. That part is universal. What varies wildly is which everyday
operations count as mutation, and how visibly the language marks the
difference.

```go
// Go: reassigning a slice header doesn't touch what it used to point at.
s := []int{1, 2, 3}
t := s
s = append(s, 4)   // may or may not touch t's box, depending on capacity —
                    // this is exactly the ambiguity that makes slices tricky
```

```javascript
// JavaScript: same shape as the Python example above.
let a = [1, 2, 3];
let b = a;
a = [4, 5, 6]; // rebinding — b still [1, 2, 3]
b.push(7); // mutation — a is unaffected either way
```

```cpp
// C++: assignment on std::vector copies the contents, not the label.
std::vector<int> a = {1, 2, 3};
std::vector<int> b = a;   // b is a separate box with the same contents
b.push_back(4);           // a is untouched — this was a copy, not an alias
```

The C++ example is worth sitting with, because it breaks the pattern the
other three shared. C++ value types copy on assignment by default, so
`b = a` doesn't even give you two labels on one box. It gives you two boxes
with identical starting contents. `apps/learning-service/src/assets/content/letsgocpp/modules/basics/05-pointers-references.md`
covers how you opt back into aliasing with a reference or a pointer when you
want it: the C++ course is where this gets worked through with the full
vocabulary of pointers, references, and `const`.

---

## Why Rust Makes This the Whole Point

Rust's move semantics read as a brand-new, alien rule if you meet them cold.
They read as a name if you've already got this distinction in hand.

```rust
let s1 = String::from("hello");
let s2 = s1;          // ownership moves: s1 no longer names anything valid

println!("{}", s1);   // compile error
```

This isn't a new kind of operation invented for Rust. It's the same
rebinding-versus-mutation split you just walked through, with one added
rule: when ownership of a heap value moves from `s1` to `s2`, Rust
invalidates the old label instead of leaving it dangling around a box it no
longer controls. Assigning a `String` doesn't copy the box (that's `.clone()`,
an explicit deep copy) and it doesn't leave two labels on one box (that's
what a `&` reference is for). It moves the label and revokes the old one.
`apps/learning-service/src/assets/content/letsgorust/modules/ownership/01-ownership-rules.md`
walks through exactly this, including `.clone()` and the `Copy` types that
opt out of moving entirely. Read it once you have this lesson's vocabulary,
because the whole lesson is answering "which of the two things is this?"
for one extra case: transfer of ownership.

---

## The Question to Practice Asking

Every time you see an assignment, a function call passing a value, or a
method that looks like it might change something, ask:

1. Is a name being pointed at a different value, or is a value being changed
   in place?
2. If a value is being changed in place, does anything else hold a name
   pointing at that same value?
3. If yes, will that other name observe the change?

Get comfortable answering these three questions, and the next lesson, on
what "immutable" actually locks down, will make a distinction you're
already primed to expect.
