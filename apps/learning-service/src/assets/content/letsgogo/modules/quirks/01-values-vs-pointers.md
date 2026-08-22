# Values vs Pointers

One of the most important concepts in Go is understanding when you're working with a value or a pointer. This is different from JavaScript/TypeScript where objects are always passed by reference.

## Value Types vs Reference Types

In Go:

| Category  | Types                                   | Passed by    |
| --------- | --------------------------------------- | ------------ |
| Value     | int, float, bool, string, array, struct | Value (copy) |
| Reference | slice, map, channel, pointer, interface | Reference    |

## The Key Difference

```go
type Person struct {
    Name string
    Age  int
}

// Value receiver - operates on a copy
func (p Person) Birthday() {
    p.Age++ // Only changes the copy!
}

// Pointer receiver - operates on the original
func (p *Person) Birthday() {
    p.Age++ // Changes the original
}
```

```go
person := Person{Name: "Alice", Age: 30}

// Value call
person.Birthday()
fmt.Println(person.Age) // Still 30!

// Pointer call
(&person).Birthday()
// Or: person.Birthday() - Go auto- dereferences
fmt.Println(person.Age) // 31!
```

## When to Use Pointers

### 1. When you need to modify the original

```go
func updateName(p *Person, name string) {
    p.Name = name
}

person := Person{Name: "Alice"}
updateName(&person)
fmt.Println(person.Name) // "Bob" - modified!
```

### 2. For large structs (avoid copying)

```go
type BigStruct struct {
    Data [10000]byte
    ID   int
}

// Don't do this - copies 10KB!
func processLarge(s BigStruct) { }

// Do this instead - passes 8 bytes (pointer)
func processLarge(s *BigStruct) { }
```

### 3. When nil is valid

```go
func findUser(id int) *User {
    // Can return nil if not found
    user, err := db.FindUser(id)
    if err != nil {
        return nil // Easy!
    }
    return user
}
```

## When to Use Values

### 1. For small, immutable data

```go
type Point struct {
    X, Y int
}

// Safe to pass by value - only 16 bytes
func distance(p1, p2 Point) int {
    dx := p1.X - p2.X
    dy := p1.Y - p2.Y
    return dx*dx + dy*dy
}
```

### 2. For maps and slices (already references)

```go
func addItem(slice []int, item int) []int {
    return append(slice, item) // Returns new slice
}

nums := []int{1, 2, 3}
nums = addItem(nums, 4) // Reassign to use new slice
```

## The Zero Value of Pointers

```go
var p *Person // nil - safe to check
if p != nil {
    fmt.Println(p.Name) // Won't panic on nil check
}

// But dereferencing nil panics!
var p2 *Person
fmt.Println(p2.Name) // PANIC!
```

## Best Practices

1. **Be consistent** - Pick value or pointer and stick with it
2. **Use pointers for methods that modify state**
3. **Use values for small, immutable data**
4. **Document nil behavior** - Is nil valid for this type?
5. **Prefer small receivers** - Use value receivers when possible

## Common Pitfall

```go
// WRONG - modifying won't work
func updateMap(m map[string]int) {
    m["key"] = 42 // This WORKS because maps are references!
}

// But slices don't auto-reallocate:
func updateSlice(s []int) {
    s = append(s, 42) // Only modifies local copy
}
s := []int{1, 2, 3}
updateSlice(s)
fmt.Println(s) // Still [1, 2, 3]!

// Fix:
func updateSlice(s *[]int) {
    *s = append(*s, 42)
}
updateSlice(&s)
fmt.Println(s) // [1, 2, 3, 42]
```

## Code Playground

Experiment with value vs pointer semantics!
