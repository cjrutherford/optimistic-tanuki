# Two Different Things Called Polymorphism

"Polymorphism" gets used as one word for two genuinely different
mechanisms, solving two different problems, with two different performance
models. Conflating them is why "polymorphism" often feels like a vague
umbrella term rather than a precise idea, because as one word, it's
covering ground that needs two.

---

## Subtype Polymorphism: One Interface, Many Behaviors Chosen at Runtime

The first kind answers: "I have several different types that share an
interface, and I want to call a method on any of them without knowing which
concrete type I'm holding, and have the right implementation run."

```cpp
class Shape {
public:
    virtual double area() const = 0;
    virtual ~Shape() = default;
};

class Circle : public Shape {
    double r_;
public:
    Circle(double r) : r_(r) {}
    double area() const override { return 3.14159 * r_ * r_; }
};

class Rectangle : public Shape {
    double w_, h_;
public:
    Rectangle(double w, double h) : w_(w), h_(h) {}
    double area() const override { return w_ * h_; }
};

void printArea(const Shape& shape) {
    std::cout << "Area: " << shape.area() << "\n";  // runtime dispatch
}
```

`printArea` doesn't know, at compile time, whether it's holding a `Circle`
or a `Rectangle`. The correct `area()` gets selected while the program is
running, by looking up the concrete type's implementation through a vtable,
a per-object pointer to a table of function pointers, one per virtual
method. `apps/learning-service/src/assets/content/letsgocpp/modules/oop/03-polymorphism.md`
covers this mechanism in full, including why the dispatch has a real,
measurable cost: every virtual call is a pointer dereference through the
vtable rather than a direct jump to a known function address, and that
lookup happens fresh, every call, at runtime.

This is subtype polymorphism: many _types_, one shared interface, the
concrete behavior selected dynamically based on which type a value actually
is right now.

---

## Parametric Polymorphism: One Implementation, Many Types Filled In at Compile Time

The second kind answers a different question: "I want to write this
function or structure exactly once, and have it work correctly for any type
that fits, without picking a specific type at all."

```cpp
template<typename T>
T add(T a, T b) {
    return a + b;
}

add(3, 4);         // T = int    → 7
add(3.14, 2.71);   // T = double → 5.85
```

There's no shared interface being dispatched through here: `add` doesn't
call some `Addable::add()` method looked up at runtime. `T` gets filled in
by the compiler, once per concrete type actually used, and a completely
separate, fully concrete `add` function is generated for `int`, another for
`double`, and so on. `apps/learning-service/src/assets/content/letsgocpp/modules/templates/01-function-templates.md`
covers this (templates resolved entirely at compile time) and its
takeaways are explicit that this has zero runtime dispatch cost, because by
the time the program runs, there is no generic `add` left at all, only the
specific versions the compiler generated.

This is parametric polymorphism: one _implementation_, written once,
specialized to concrete types before the program ever runs.

---

## Same Distinction, Different Vocabulary

Rust's generics are the same idea as C++ templates, worked out by
compile-time specialization rather than runtime lookup:

```rust
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut largest = &list[0];
    for item in list.iter() {
        if item > largest {
            largest = item;
        }
    }
    largest
}
```

`apps/learning-service/src/assets/content/letsgorust/modules/traits/02-generics.md`
names the mechanism directly: monomorphization, the compiler generating a
distinct `largest_i32`, `largest_char`, and so on for every type actually
used, at zero runtime cost: the same performance story as C++ templates,
for the same reason: no dispatch happens while the program runs, because
nothing generic is left in the compiled output.

TypeScript's generics are this same idea again, in a language without a
compile step that erases types into specialized machine code: `wrap<T>` in
`apps/learning-service/src/assets/content/letsgots/modules/type-system/03-generics.md`
is parametric polymorphism checked statically and then erased at compile
time, with no runtime representation of `T` at all.

---

## Rust Traits Blur the Line on Purpose

Rust's trait system supports both kinds of polymorphism from one syntax,
and which one you get depends entirely on _how_ you use the trait as a
bound, which is exactly the detail worth being careful with, because it
changes the performance model.

```rust
// Static dispatch — parametric polymorphism.
// T is filled in and monomorphized at compile time, one function
// generated per concrete type actually used, same as `largest` above.
fn notify<T: Summary>(item: &T) {
    println!("Breaking news! {}", item.summarize());
}

// Dynamic dispatch — subtype polymorphism.
// The concrete type behind `dyn Summary` is erased; the right
// `summarize` is looked up through a vtable at runtime, same
// mechanism as C++'s virtual functions above.
fn print_all(items: &[Box<dyn Summary>]) {
    for item in items {
        println!("{}", item.summarize());
    }
}
```

`apps/learning-service/src/assets/content/letsgorust/modules/traits/01-traits.md`
covers trait objects (`dyn Trait`) as "runtime polymorphism," directly
alongside trait bounds used generically. Both `notify` and `print_all` are
written against the same trait, `Summary`, but they are using two different
polymorphism mechanisms: `notify<T: Summary>` monomorphizes, generating a
separate function per type with no dispatch overhead, the same as a C++
template or a Rust generic function. `Box<dyn Summary>` erases the concrete
type behind a trait object and dispatches through a vtable at runtime, the
same mechanism, and the same per-call cost, as a C++ virtual function
call. The syntax difference is one word, `dyn`, but it's selecting between
two fundamentally different mechanisms with two different performance
profiles, and that's worth reading twice: it's the reason "just use a trait
bound" and "just use `dyn Trait`" are not interchangeable pieces of advice,
even though both compile and both work.

---

## Telling Them Apart

1. If the concrete type is erased and the right implementation is found by
   looking it up while the program runs, a vtable lookup, a virtual call, a
   `dyn Trait`, that's subtype polymorphism, and it costs a dispatch on
   every call.
2. If the compiler generates a separate, fully concrete version of the code
   for every type actually used, before the program runs: a C++ or Rust
   generic function, a monomorphized trait bound, that's parametric
   polymorphism, and by the time the program runs, there is no dispatch left
   to pay for.
3. When a language lets you write one generic-looking piece of code and
   choose the mechanism (Rust's `T: Trait` versus `dyn Trait`), the
   performance difference between the two choices is real, not cosmetic:
   check which one you actually reached for.
