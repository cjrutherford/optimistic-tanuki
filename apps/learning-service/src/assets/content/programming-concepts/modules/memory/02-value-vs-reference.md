# Copying a Value, Copying Access

Ask what `b := a` does and most people answer with how it's usually passed to
a function, because those two facts get taught together and then get
remembered as one fact. They aren't one fact. Whether an assignment copies a
value or copies access to a value is a property of the _type_. Whether a
function receives its own copy or shares the caller's is a property of the
_call_. A language can (and every language you'll use does) mix these two
choices in ways that surprise people who never separated them.

---

## The Distinction Itself

Copying a **value** produces an independent second thing. Changing the copy
never touches the original, and changing the original never touches the
copy, because after the copy there are two of them.

Copying a **reference** produces a second name for the same one thing. There
is still only one value; there are now two ways to reach it, and a change
through either one is visible through both.

```python
a = [1, 2, 3]
b = a          # b is a second name for a's list — no copy happened
b.append(4)
print(a)       # [1, 2, 3, 4] — a sees it, because there was only ever one list
```

```cpp
std::vector<int> a = {1, 2, 3};
std::vector<int> b = a;   // b is a genuine copy — assignment copies the value
b.push_back(4);
// a is still {1, 2, 3}
```

Same syntax, `=`, doing two different things, because `std::vector`'s
assignment operator copies and Python's list assignment binds a name. Nothing
about the word "assignment" tells you which one you're looking at. Only the
type does.

---

## Why "How It's Passed" Is a Different Question

Here is the distinction most material collapses. Passing a value type to a
function and passing a reference type to a function are two separate axes,
and a language typically picks one answer per axis, not one answer total:

- **What does the type do on copy?** Duplicate the data, or duplicate
  access to it.
- **How does the language get a value into a function call?** By giving
  the function its own copy of whatever you handed it, or by giving the
  function the same thing you have.

Most languages you'll meet always do the second one the same way (they pass
"by value" in the sense that the function gets its own copy of whatever
binding you passed) and let the _first_ question do all the work. That's
why it looks like "objects are passed by reference" in Python or JavaScript:
what's actually happening is that the thing being copied into the function's
parameter is a reference, and copying a reference duplicates access, not
data.

```javascript
function mutate(obj) {
  obj.x = 99; // reaches the same object the caller has
}
function reassign(obj) {
  obj = { x: 0 }; // rebinds the *local* parameter only
}

const o = { x: 1 };
mutate(o);
console.log(o.x); // 99 — the shared object was mutated

reassign(o);
console.log(o.x); // still 99 — reassigning the parameter didn't touch o
```

`mutate` and `reassign` both received the same copied reference. `mutate`
used it to change the object the reference points at, which the caller
observes. `reassign` pointed its own copy of the reference somewhere else,
which the caller cannot observe, because the caller's reference was never
touched. This is the same rebinding-versus-mutation split, applied to a
function parameter instead of a local variable.

Laid out as a grid, with one real example in each cell, the two axes look
like this:

|                        | Call passes a copy                                                                      | Call passes the same reference                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Type copies data**   | C++ `byValue(std::vector<int>)`: a fresh vector, mutating it never touches the caller's | C++ `byRef(std::vector<int>&)`: same vector, mutating it mutates the caller's                         |
| **Type copies access** | (rare in practice; would need a language that copies a reference's pointee per call)    | JS `mutate(obj)`: a copied reference to the same object, mutating through it is visible to the caller |

The top-left and bottom-right cells are the two everyday cases, "genuinely
independent" and "genuinely shared." The top-right cell, C++'s `byRef`, is
what makes even a value-copying type behave like the shared case for that
one call. The bottom-left cell is close to empty because almost no
mainstream language bothers to deep-copy the pointee of a reference just
because it crossed a function boundary; that would defeat the point of
having reference types at all.

---

## Go Makes Both Axes Visible at Once

Go is a useful case precisely because it has value types and reference-like
types side by side, and is consistent about copying whatever you hand it on
every call.

```go
type Point struct{ X, Y int }

func moveValue(p Point) { p.X = 99 }   // p is a struct: gets a full copy
func moveRef(s []int)   { s[0] = 99 }  // s is a slice header: gets a copy
                                        // of the header, which still points
                                        // at the caller's underlying array

pt := Point{X: 1}
moveValue(pt)
fmt.Println(pt.X) // 1 — untouched, Point is a value type

nums := []int{1, 2, 3}
moveRef(nums)
fmt.Println(nums[0]) // 99 — the header was copied, but it still names
                      // the same backing array
```

Both functions receive a copy. Go passes everything the same way. What
differs is what's _inside_ the copy: a struct's fields, versus a slice
header's pointer to shared data. `letsgogo/modules/quirks/01-values-vs-pointers.md`
covers this split across Go's whole type system, which types are structs
and arrays (value) versus slices, maps, and channels (reference-like), and
is worth reading with this lesson's two-axis framing already in hand, because
the Go course explains _which types behave which way_ without necessarily
naming the two-axis distinction underneath it.

---

## C++ Lets You Choose Per Call

C++ is the language where the "how it's passed" axis is most visibly a
separate choice, because you write it at every call site:

```cpp
void byValue(std::vector<int> v)   { v.push_back(4); }  // copies the vector
void byRef(std::vector<int>& v)    { v.push_back(4); }  // shares the caller's

std::vector<int> nums = {1, 2, 3};
byValue(nums);
// nums is still {1, 2, 3} — the function's copy grew, not the original

byRef(nums);
// nums is now {1, 2, 3, 4}
```

`std::vector` is a value type either way: its own assignment operator
always copies. What changes between `byValue` and `byRef` is purely the
second axis: whether the function parameter is a fresh copy of that value or
a reference to the caller's one. Nothing here is about `vector` being
special; the same `&` distinction applies to an `int`.

---

## The Question to Practice Asking

When you meet an unfamiliar language's assignment or function-call syntax,
separate the two questions instead of answering them together:

1. Does this type's copy duplicate the data, or duplicate access to one
   shared thing?
2. Independently, does this call give the function its own copy of whatever
   I handed it, or the same one I have?
3. If the type in front of you copies access, and the language also hands
   functions the same reference you have, that's two reasons full
   independence isn't guaranteed: check both before assuming a function
   can't affect your data.

Keeping these separate is what makes a new language's parameter-passing
rules read as "one axis I already know, one axis this language answers
differently" instead of a fresh fact to memorize per language.
