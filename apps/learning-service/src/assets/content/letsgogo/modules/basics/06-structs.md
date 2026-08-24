# Structs

A struct is a type made of named fields. It is how you say "these values belong
together" in Go, and it is the closest thing Go has to a class.

You have already seen structs in passing — `Rectangle` in the custom types
lesson was one. This lesson is where they get explained properly.

---

## Declaring a Struct

```go
type User struct {
    ID    int
    Name  string
    Email string
}
```

That declares a type. It does not create anything yet — no memory, no value.
`User` is now a type you can use anywhere a type is expected.

Fields that start with a capital letter are exported and visible to other
packages. Lowercase fields are private to the package that declared them. This
is the same rule as function names, applied to fields.

```go
type Account struct {
    Owner    string  // other packages can read and write this
    balance  int     // only this package can touch it
}
```

---

## Creating Values

Four ways, and the differences matter.

```go
// 1. Zero value. Every field gets its type's zero: 0, "", nil, false.
var u User
// u is {0 "" ""} -- ready to use, not nil, no allocation ceremony

// 2. Field names. Use this one.
u := User{
    ID:    1,
    Name:  "Ada",
    Email: "ada@example.com",
}

// 3. Positional. Avoid it.
u := User{1, "Ada", "ada@example.com"}

// 4. Pointer to a new value.
u := &User{Name: "Ada"}
```

Prefer the third form's alternative — named fields — for a concrete reason.
Positional literals must list every field in declaration order, so the day
somebody adds a field to `User`, every positional literal in the codebase stops
compiling. Worse, if somebody _reorders_ two fields of the same type, positional
literals keep compiling and silently swap the values. Named fields survive both.

Note what the zero value gives you. Unlike many languages, a struct in Go is
usable the moment it is declared. There is no null, no uninitialised state, no
constructor you have to remember to call.

```go
var u User
u.Name = "Ada"      // fine, no allocation needed first
fmt.Println(u.Name) // Ada
```

Omitted fields in a literal get the zero value too:

```go
u := User{Name: "Ada"}  // ID is 0, Email is ""
```

---

## Reading and Writing Fields

```go
u := User{Name: "Ada"}

u.Name = "Ada Lovelace"   // write
name := u.Name            // read
```

The dot works on pointers too, and this is a place Go quietly helps you:

```go
p := &User{Name: "Ada"}

p.Name = "Grace"    // Go writes (*p).Name for you
fmt.Println(p.Name) // Grace
```

In C you would need `p->Name`. Go has no `->`; the dot handles both a value and
a pointer to a value.

---

## Structs Are Values

This is the single most important thing about structs in Go, and the source of
most surprises for people arriving from languages where objects are references.

**Assigning a struct copies it.**

```go
a := User{Name: "Ada"}
b := a          // b is a full, independent copy
b.Name = "Grace"

fmt.Println(a.Name) // Ada   -- unchanged
fmt.Println(b.Name) // Grace
```

The same applies to passing one to a function:

```go
func rename(u User) {
    u.Name = "Changed"   // changes the local copy and nothing else
}

a := User{Name: "Ada"}
rename(a)
fmt.Println(a.Name)  // Ada
```

To let a function modify the original, pass a pointer:

```go
func rename(u *User) {
    u.Name = "Changed"
}

a := User{Name: "Ada"}
rename(&a)
fmt.Println(a.Name)  // Changed
```

---

## Methods

A method is a function with a receiver — the parameter before the name.

```go
type Rectangle struct {
    Width  float64
    Height float64
}

// Value receiver: gets a copy.
func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}

// Pointer receiver: gets the original, and can change it.
func (r *Rectangle) Scale(factor float64) {
    r.Width *= factor
    r.Height *= factor
}
```

```go
r := Rectangle{Width: 3, Height: 4}
fmt.Println(r.Area())  // 12

r.Scale(2)             // Go takes the address for you: (&r).Scale(2)
fmt.Println(r.Area())  // 48
```

### Choosing a Receiver

The rule that will not steer you wrong:

**Use a pointer receiver if the method modifies the receiver, or if the struct
is large. Otherwise use a value receiver. Then make every method on the type
use the same one.**

Modification is the part with teeth. A value receiver gets a copy, so writing to
it accomplishes nothing:

```go
// Broken. Compiles fine, does nothing.
func (r Rectangle) BrokenScale(factor float64) {
    r.Width *= factor   // modifies the copy, which is discarded on return
}

r := Rectangle{Width: 3, Height: 4}
r.BrokenScale(2)
fmt.Println(r.Width)  // 3
```

No error, no warning. This is one of the most common Go bugs, and the only
defence is knowing which receiver you asked for.

The consistency half of the rule matters because a type with a mix of receivers
is confusing to read and can fail to satisfy an interface — the next lesson
explains why.

---

## Comparing Structs

Structs are comparable with `==` if all their fields are:

```go
a := User{ID: 1, Name: "Ada"}
b := User{ID: 1, Name: "Ada"}
fmt.Println(a == b)  // true -- field by field
```

But a struct containing a slice, map, or function is not comparable, and `==`
is a compile error:

```go
type Tagged struct {
    Name string
    Tags []string   // slices are not comparable
}

// t1 == t2
// invalid operation: t1 == t2 (struct containing []string cannot be compared)
```

For those, compare explicitly or use `reflect.DeepEqual` in tests.

---

## Embedding

Go has no inheritance. It has embedding: declare a field with no name, and the
outer struct gets the inner one's fields and methods promoted onto it.

```go
type Animal struct {
    Name string
}

func (a Animal) Speak() string {
    return a.Name + " makes a sound"
}

type Dog struct {
    Animal        // embedded, no field name
    Breed  string
}
```

```go
d := Dog{
    Animal: Animal{Name: "Rex"},
    Breed:  "Husky",
}

fmt.Println(d.Name)     // Rex        -- promoted field
fmt.Println(d.Speak())  // Rex makes a sound -- promoted method
fmt.Println(d.Animal.Name) // Rex     -- the long way, always available
```

This is composition, not inheritance. `Dog` is not a subtype of `Animal`: you
cannot pass a `Dog` to a function expecting an `Animal`. What you get is the
fields and methods, spelled shorter. If `Dog` declares its own `Speak`, that one
wins and `Animal`'s is still reachable as `d.Animal.Speak()`.

---

## Struct Tags

A field can carry a string tag that libraries read at runtime. The most common
use by far is JSON:

```go
type User struct {
    ID    int    `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email,omitempty"`
    token string `json:"-"`
}
```

Now `encoding/json` writes `{"id":1,"name":"Ada"}` rather than using the Go
field names. `omitempty` drops the field when it holds its zero value, and `-`
excludes it entirely.

Tags are just strings — the compiler does not check them. A typo in `json:"nmae"`
compiles and silently produces the wrong key, so read them carefully.

---

## Anonymous Structs

For a one-off shape that does not deserve a name:

```go
config := struct {
    Host string
    Port int
}{
    Host: "localhost",
    Port: 8080,
}
```

These show up most often in table-driven tests, which the testing module covers.

---

## Best Practices

1. Use named fields in literals, never positional ones
2. Pick a receiver by whether the method modifies, then stay consistent across the type
3. Remember that assignment copies — pass a pointer when you mean to share
4. Let the zero value be useful, so `var u User` is ready to work with
5. Export only the fields other packages genuinely need
6. Prefer embedding over trying to recreate inheritance
