# Passing Behaviour, Not Just Data

A struct or a class carries data from one place to another. Its shape is
fixed at compile time, and every value of that type has the same fields in
the same layout. A function passed as a value carries something else: a
choice of _what to do_, deferred to whoever ends up holding it.

That difference (data describes state, a first-class function describes
behaviour) is easy to state and easy to underuse. This lesson is about
taking it seriously.

---

## What "First-Class" Actually Means

A value is first-class in a language if it can go everywhere other values
go: assigned to a variable, stored in a field, passed as an argument,
returned from a function, put in a collection. Integers are first-class in
every language in these courses. Whether _functions_ are first-class is the
question this lesson is about, and in Go, TypeScript, Rust, and modern C++,
the answer is yes.

```go
add := func(a, b int) int { return a + b }
var op func(int, int) int = add
fmt.Println(op(2, 3)) // 5
```

```rust
let add = |a: i32, b: i32| a + b;
let op: fn(i32, i32) -> i32 = add;
println!("{}", op(2, 3)); // 5
```

```cpp
auto add = [](int a, int b) { return a + b; };
std::function<int(int, int)> op = add;
std::cout << op(2, 3); // 5
```

None of this is exotic: it's a variable holding a function instead of a
number. The interesting part starts when the function is a _parameter_.

---

## Passing Behaviour as an Argument

Compare two ways to write a function that needs to compare two items.

**Data-only version**: bake the comparison in.

```go
func sortByPriceAscending(items []Item) {
    sort.Slice(items, func(i, j int) bool {
        return items[i].Price < items[j].Price
    })
}
```

**Behaviour-as-parameter version**: take the comparison as an argument.

```go
func sortBy(items []Item, less func(a, b Item) bool) {
    sort.Slice(items, func(i, j int) bool {
        return less(items[i], items[j])
    })
}

sortBy(items, func(a, b Item) bool { return a.Price < b.Price })
sortBy(items, func(a, b Item) bool { return a.Name < b.Name })
```

The first version is a function that does one specific thing. The second is a
function that does a _family_ of things, parameterized by the piece its
caller supplies. Nothing about `sortBy` needed to change to sort by name
instead of price. The behaviour moved from being hardcoded inside the
function to being handed in as data.

This is the core move. A function parameter of function type is not "a
value that happens to be callable": it's a slot for _policy_, left open for
the caller to fill in. `sort.Slice` in Go's standard library, `Array.sort`
with a comparator in JavaScript/TypeScript, `Vec::sort_by` in Rust, and
`std::sort` with a comparator in C++ are the same idea wearing four sets of
syntax.

---

## Higher-Order Functions

A function that takes or returns another function is called _higher-order_.
`sortBy` above is higher-order because it takes `less`. So is anything that
returns a function to be called later:

```rust
fn multiplier(factor: i32) -> impl Fn(i32) -> i32 {
    move |x| x * factor
}

let double = multiplier(2);
let triple = multiplier(3);
println!("{}", double(5)); // 10
println!("{}", triple(5)); // 15
```

`multiplier` doesn't compute a number: it manufactures a function, one
configured differently each time it's called. `double` and `triple` are
independent pieces of behaviour, built from the same recipe. The Rust course
covers this shape in `letsgorust/modules/basics/03-functions.md`, where
closures and higher-order functions like `apply` are introduced directly;
the Go course's function lesson,
`letsgogo/modules/basics/03-functions.md`, does the same with anonymous
functions and closures returned from `adder`.

That returned function (`double`, `triple`, the thing `adder` hands back)
remembers `factor` or `sum` from where it was built. How it remembers is not
"it copied the value once and moved on"; the next lesson is entirely about
getting that part right, because getting it wrong is the most common bug
this module covers.

---

## Why This Beats Hardcoding

Three habits fall out of treating functions as ordinary values:

**Callbacks.** Event handlers, "run this when the request finishes,"
"run this for each row": all of these are a function passed to code that
doesn't know in advance what it should do, only when to do it.

**Strategy without a class hierarchy.** In languages with heavier
object systems, "pick one of several algorithms at runtime" is often solved
with an interface and a family of classes, one per strategy. A first-class
function collapses that down to: pass a different function. `sortBy` above
needed no `Comparator` interface and no `PriceComparator` class. It needed
one function value.

**Deferred work.** A function value is a computation that hasn't happened
yet. Storing one in a variable, a struct field, or a queue is a way to say
"do this later," without inventing a data structure to describe what "this"
means. A queue of `func()` values _is_ a task queue.

---

## The Line This Lesson Draws

Passing a function is not passing a special kind of data: it's passing a
decision. The caller of `sortBy` decides what "less than" means; `sortBy`
itself never needs to know. That inversion (the callee holds the shape of
the computation, the caller holds the content) is what "first-class
functions" buys a codebase, and it's worth noticing every time a function
signature includes another function as a parameter or a return type.

1. If a type can be assigned, stored, passed, and returned like any other
   value, it's first-class; ask this of function types specifically.
2. A function taking or returning a function is higher-order; it describes
   a family of behaviours, not one.
3. Passing a function as an argument moves a decision from the callee to the
   caller without adding an interface or a class.
4. A function returned from another function usually needs to remember
   something from its birthplace; how it remembers is the next lesson.
