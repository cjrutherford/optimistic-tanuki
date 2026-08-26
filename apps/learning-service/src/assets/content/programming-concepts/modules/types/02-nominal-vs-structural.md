# Same Shape, Different Identity

Two types can have identical fields and methods and still disagree, in some
languages, about whether one satisfies the other. That disagreement isn't a
quirk. It's a language committing to one of two different answers to a
basic question: does a type's identity come from its _shape_, or from its
_name_? Most material calls this "different syntax for interfaces" and moves
on. It isn't syntax. It's a different rule for what counts as satisfying a
contract, and the two rules fail in opposite, specific ways.

---

## Structural: If It Fits, It Satisfies

Go interfaces are satisfied by shape alone. A type never declares which
interfaces it implements: the compiler works that out by comparing method
sets wherever the type is actually used as that interface.

```go
type Shape interface {
    Area() float64
    Perimeter() float64
}

type Rectangle struct {
    Width, Height float64
}

func (r Rectangle) Area() float64      { return r.Width * r.Height }
func (r Rectangle) Perimeter() float64 { return 2 * (r.Width + r.Height) }
```

`Rectangle` never mentions `Shape`. It satisfies the interface purely
because it has both methods with matching signatures. `apps/learning-service/src/assets/content/letsgogo/modules/basics/07-interfaces.md`
covers this in full, including the real consequence that follows from it:
you can define an interface for a type you don't own, because satisfaction
doesn't require the type's author to have known your interface exists. That
lesson also names the convention structural typing enables: define the
interface where it's _consumed_, not where the implementing type lives,
since nothing has to be declared at the implementation site anyway.

---

## Nominal: Satisfying Isn't Enough — You Have to Say So

C++ and Rust take the opposite position: having the right shape is not
sufficient. A type only counts as implementing an interface if it explicitly
declares that it does.

```rust
trait Summary {
    fn summarize(&self) -> String;
}

struct Article {
    title: String,
    content: String,
}

impl Summary for Article {
    fn summarize(&self) -> String {
        format!("{}: {}...", self.title, &self.content[..50.min(self.content.len())])
    }
}
```

`impl Summary for Article` is the declaration Go never requires. Give
`Article` a method called `summarize` with the right signature, but leave
out the `impl Summary for Article` block, and Rust does not consider
`Article` a `Summary` (no matter how exactly the method matches) because
nothing declared the relationship. `apps/learning-service/src/assets/content/letsgorust/modules/traits/01-traits.md`
walks through defining and implementing a trait this way, plus default
method implementations, which only make sense once you accept that
conformance is an explicit act, not an incidental fact about method names.

C++ takes the same nominal stance through virtual inheritance: a class
satisfies an abstract base only by explicitly deriving from it:
`class Circle : public Shape`, and overriding its pure virtual methods,
covered in `apps/learning-service/src/assets/content/letsgocpp/modules/oop/03-polymorphism.md`.
A `Circle`-shaped class that happens to define `area()` and `describe()` but
never writes `: public Shape` is not a `Shape` as far as the compiler is
concerned, no matter how closely its methods match.

---

## Where Each Rule Actually Bites You

These aren't equivalent choices with different spelling. They fail in
opposite directions, and knowing which failure to expect is the entire
payoff of understanding the distinction.

**Structural typing can be satisfied by accident.** Because nothing is
declared, two unrelated types that happen to share a method name and
signature both satisfy the same interface, whether or not that was ever
intended.

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type SuspiciousLogger struct{}

// Coincidentally has the same signature as io.Reader.Read,
// implemented for a completely unrelated purpose.
func (s SuspiciousLogger) Read(p []byte) (int, error) {
    return 0, nil
}
```

`SuspiciousLogger` now satisfies `io.Reader` structurally, purely by
signature coincidence, even though reading bytes was never its intent. This
usually doesn't cause real bugs: most accidental matches are either
harmless or caught by a test. But it is a real, specific failure mode that
nominal typing cannot produce, because nominal typing never infers
conformance from shape alone.

**Nominal typing demands boilerplate for a contract you obviously meet.**
The opposite failure: a type genuinely has every method a trait or
interface requires, with correct signatures, and still doesn't count,
because nobody wrote the declaration.

```rust
struct Point { x: f64, y: f64 }

impl Point {
    fn summarize(&self) -> String {
        format!("({}, {})", self.x, self.y)
    }
}

// Point has exactly the method Summary requires.
// It is still not a Summary, anywhere in the program,
// until an `impl Summary for Point` block is written.
```

This is friction with no corresponding safety benefit in a case like this
one: the shape is right, the intent is obvious, and the language still
requires you to say so explicitly, every time, for every trait a type is
meant to satisfy.

---

## Compile-Time Verification, Both Directions

Go's ecosystem worries enough about the accidental-satisfaction failure mode
that it has a standard idiom for catching the opposite problem: a type
_losing_ an interface it was relying on, silently:

```go
var _ Shape = (*Rectangle)(nil)
```

This line does nothing at runtime. It exists purely so the compiler checks,
at the point `Rectangle` is defined, that it still satisfies `Shape`, so
that if a method gets renamed or removed later, the error shows up here
instead of at some distant call site. It's a structural language borrowing
a bit of the certainty a nominal language gets for free, by declaring intent
explicitly in one specific spot.

---

## Naming What You're Looking At

1. If a type must declare, by name, which interfaces or traits it
   implements, that's nominal typing: C++'s `: public Base` and Rust's
   `impl Trait for Type` are both this, in different syntax for the same
   commitment.
2. If a type satisfies an interface purely by having the right methods, with
   no declaration anywhere, that's structural typing: Go's interfaces are
   the clearest mainstream example.
3. Structural typing's risk is accidental conformance; nominal typing's cost
   is required boilerplate for conformance that was never in doubt. Neither
   risk is hypothetical, and recognizing which one a language has chosen
   tells you which kind of bug to watch for.
