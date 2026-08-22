# Borrowing and References

Instead of moving ownership, you can **borrow** a value using references.

## References

A reference lets you refer to a value without taking ownership:

```rust
fn calculate_length(s: &String) -> usize {
    s.len()  // s is borrowed, not owned
}  // s goes out of scope but the value is NOT dropped

fn main() {
    let s = String::from("hello");
    let len = calculate_length(&s);  // pass a reference
    println!("The length of '{}' is {}", s, len);  // s still valid!
}
```

## Mutable References

To modify a borrowed value, use a **mutable reference**:

```rust
fn add_world(s: &mut String) {
    s.push_str(", world");
}

let mut s = String::from("hello");
add_world(&mut s);
println!("{}", s);  // "hello, world"
```

### The Borrowing Rules

1. At any time, you can have **either**:
   - One mutable reference, **or**
   - Any number of immutable references
2. References must always be valid (no dangling references)

```rust
let mut s = String::from("hello");

let r1 = &s;      // OK
let r2 = &s;      // OK (multiple immutable references)
// let r3 = &mut s; // ERROR: cannot borrow as mutable while borrowed as immutable
```

## String Slices

A string slice `&str` is a reference to part of a String:

```rust
let s = String::from("hello world");
let hello = &s[0..5];   // "hello"
let world = &s[6..11];  // "world"
```

String literals are already `&str`:

```rust
let s: &str = "hello";  // This is a slice pointing to the binary
```

## The Slice Type

Slices work for other types too:

```rust
let a = [1, 2, 3, 4, 5];
let slice = &a[1..3];  // [2, 3]
```

> **Challenge**: Write a function that borrows a String and returns its length.
