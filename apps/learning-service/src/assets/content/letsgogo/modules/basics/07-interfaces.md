# Interfaces

An interface is a set of method signatures. Any type that has those methods
satisfies the interface — without saying so, without importing anything, without
the interface's author knowing that type exists.

That last part is what makes Go interfaces different from most other languages',
and it changes how you design with them.

---

## Declaring an Interface

```go
type Shape interface {
    Area() float64
    Perimeter() float64
}
```

Any type with both of those methods is a `Shape`. There is no `implements`
keyword:

```go
type Rectangle struct {
    Width, Height float64
}

func (r Rectangle) Area() float64      { return r.Width * r.Height }
func (r Rectangle) Perimeter() float64 { return 2 * (r.Width + r.Height) }

type Circle struct {
    Radius float64
}

func (c Circle) Area() float64      { return math.Pi * c.Radius * c.Radius }
func (c Circle) Perimeter() float64 { return 2 * math.Pi * c.Radius }
```

Neither type mentions `Shape`. Both satisfy it, and the compiler checks that at
the point of use:

```go
shapes := []Shape{
    Rectangle{Width: 3, Height: 4},
    Circle{Radius: 5},
}

for _, s := range shapes {
    fmt.Printf("area %.2f, perimeter %.2f\n", s.Area(), s.Perimeter())
}
```

This is called **structural** or **implicit** satisfaction. In Java or C# you
must declare `class Rectangle implements Shape`, which means the interface has
to exist before the type, and the type has to depend on it. In Go the
relationship runs the other way, and that has a real consequence: you can
define an interface for a type you do not own. If a library gives you a type
with a `Close() error` method, you can declare your own one-method interface
and accept it, without the library changing at all.

---

## Where Interfaces Belong

Because satisfaction is implicit, Go's convention is the reverse of what most
languages teach:

**Define an interface in the package that consumes it, not the package that
implements it.**

The implementing package just writes methods. The consuming package declares
the narrow interface describing what it actually needs. This keeps the
implementer free of a dependency on an abstraction it does not use, and keeps
the interface honest — it lists what one caller needs, not everything the type
can do.

---

## Keep Them Small

The most quoted line in Go says it: _the bigger the interface, the weaker the
abstraction_. The standard library's most useful interfaces have one method
each.

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

type Stringer interface {
    String() string
}
```

`io.Reader` is satisfied by files, network connections, HTTP request bodies,
gzip streams, `strings.Reader`, `bytes.Buffer` and hundreds of types nobody has
written yet. That reach comes precisely from the interface asking for almost
nothing.

`Stringer` is worth knowing about specifically: `fmt` looks for it, so giving a
type a `String() string` method changes how it prints everywhere.

```go
type Temperature float64

func (t Temperature) String() string {
    return fmt.Sprintf("%.1f°C", float64(t))
}

fmt.Println(Temperature(21.5))  // 21.5°C
```

---

## Accept Interfaces, Return Structs

A function should ask for the least it can:

```go
// Narrow: works with a file, a socket, a buffer, a test double.
func Save(w io.Writer, data []byte) error {
    _, err := w.Write(data)
    return err
}

// Too specific: only ever works with a file.
func Save(f *os.File, data []byte) error {
    _, err := f.Write(data)
    return err
}
```

The first version is also why Go needs so little test scaffolding. To test it,
pass a `bytes.Buffer` and read what was written. No mocking framework, no
dependency injection container — just a different type that happens to have a
`Write` method.

Returning is the other direction: return the concrete type. A caller can always
narrow a concrete type to an interface, but cannot widen an interface back to
something specific without a type assertion.

---

## The Empty Interface

`interface{}` has no methods, so every type satisfies it. Since Go 1.18 it is
also spelled `any`, which is an alias — identical meaning, better name.

```go
var x any

x = 42
x = "hello"
x = []float64{1, 2, 3}
```

This looks like a way to write flexible code. It is mostly a way to throw away
everything the compiler could have done for you. A value in an `any` has no
methods you can call and no fields you can read until you get its real type
back.

Reach for `any` when you genuinely do not know the type — `json.Unmarshal`,
`fmt.Println` — and not to avoid deciding. If you want one function to work
across several types _and_ keep type checking, that is what generics are for.

---

## Getting the Type Back

### Type Assertion

```go
var x any = "hello"

// Comma-ok. Use this one.
s, ok := x.(string)
if ok {
    fmt.Println(len(s))  // 5
}

n, ok := x.(int)
fmt.Println(n, ok)  // 0 false -- zero value, no panic
```

The single-result form panics when it is wrong:

```go
s := x.(int)  // panic: interface conversion: interface {} is string, not int
```

Use it only when a failure genuinely is a bug worth crashing for.

### Type Switch

For several possibilities:

```go
func describe(v any) string {
    switch value := v.(type) {
    case nil:
        return "nothing at all"
    case int:
        return fmt.Sprintf("the integer %d", value)
    case string:
        return fmt.Sprintf("a %d-character string", len(value))
    case []int:
        return fmt.Sprintf("%d integers", len(value))
    case error:
        return "an error: " + value.Error()
    default:
        return fmt.Sprintf("something of type %T", value)
    }
}
```

Inside each case, `value` has that case's type. Note `case nil` — it matches an
interface holding nothing, which is worth handling explicitly for the reason
below.

---

## The Nil Interface Trap

This one catches everybody once, and it is worth meeting here rather than in
production.

An interface value has two parts: a type and a value. It is `nil` only when
**both** are empty. A non-nil type with a nil value is not a nil interface.

```go
type MyError struct{}

func (e *MyError) Error() string { return "boom" }

func doWork() error {
    var err *MyError = nil   // a nil pointer
    return err               // but the interface now holds (*MyError, nil)
}

func main() {
    err := doWork()
    fmt.Println(err == nil)  // false!
    if err != nil {
        fmt.Println("caller thinks something failed")  // this runs
    }
}
```

The returned interface is not nil, because its type half is `*MyError`. The
caller's `err != nil` is true and they report a failure that never happened.

The fix is to never return a typed nil. Return the literal `nil`:

```go
func doWork() error {
    if somethingWentWrong {
        return &MyError{}
    }
    return nil   // an actual nil interface
}
```

Declare error-returning helpers as `error`, not as `*MyError`, and this problem
cannot arise.

---

## Pointer Receivers and Satisfaction

This connects back to the receiver rule from the structs lesson.

If a method has a **pointer** receiver, only the **pointer** satisfies the
interface:

```go
type Counter struct{ n int }

func (c *Counter) Increment() { c.n++ }

type Incrementer interface {
    Increment()
}

var i Incrementer = &Counter{}  // fine
var j Incrementer = Counter{}   // compile error
```

```text
cannot use Counter{} (value of struct type Counter) as Incrementer value
    in variable declaration: Counter does not implement Incrementer
    (method Increment has pointer receiver)
```

The reason is that a value receiver can be called on both a value and a pointer,
but a pointer receiver needs an addressable value, and a value stored inside an
interface is not addressable. This error message is common enough that
recognising it saves real time: it almost always means you wrote `Thing{}` where
you wanted `&Thing{}`.

---

## Checking Satisfaction at Compile Time

Because nothing declares intent, a type can stop satisfying an interface without
anyone noticing until a distant call site breaks. This one-liner makes the
compiler check it where the type is defined:

```go
var _ Shape = (*Rectangle)(nil)
```

It declares a discarded variable of type `Shape`, assigns a nil `*Rectangle` to
it, and compiles to nothing. If `Rectangle` ever loses a method, the error
appears here, in the file that caused it.

---

## Best Practices

1. Keep interfaces small — one or two methods is usually right
2. Define them where they are used, not where they are implemented
3. Accept interfaces, return concrete types
4. Use `any` only when the type is genuinely unknown; prefer generics otherwise
5. Always use the comma-ok form of a type assertion unless a panic is what you want
6. Never return a typed nil from a function declared to return an interface
7. Add `var _ Iface = (*T)(nil)` when a type exists to satisfy an interface
