# Pattern Matching in Rust

Pattern matching is one of Rust's most powerful features.

## Match Expressions

`match` checks a value against a series of patterns:

```rust
let x = 5;
match x {
    1 => println!("one"),
    2 | 3 => println!("two or three"),
    4..=6 => println!("four through six"),
    _ => println!("something else"),
}
```

## Destructuring

Patterns can destructure complex types:

```rust
// Tuples
let point = (3, -2);
match point {
    (0, 0) => println!("origin"),
    (x, 0) => println!("on x-axis at {}", x),
    (0, y) => println!("on y-axis at {}", y),
    (x, y) => println!("at ({}, {})", x, y),
}

// Structs
struct Point { x: i32, y: i32 }
let p = Point { x: 5, y: 10 };
let Point { x, y } = p;

// Enums
enum Color {
    Rgb(u8, u8, u8),
    Hex(String),
}
let color = Color::Rgb(255, 128, 0);
match color {
    Color::Rgb(r, g, b) => println!("RGB: {}, {}, {}", r, g, b),
    Color::Hex(h) => println!("Hex: {}", h),
}
```

## Guards

Add conditions to match arms with `if`:

```rust
let pair = (2, -2);
match pair {
    (x, y) if x == y => println!("equal"),
    (x, y) if x + y == 0 => println!("opposites"),
    (x, _) if x % 2 != 0 => println!("first is odd"),
    _ => println!("other"),
}
```

## Binding with @

Bind a value to a name while also testing it:

```rust
match x {
    n @ 1..=12 => println!("Got {} (small)", n),
    n @ 13..=19 => println!("Got {} (teen)", n),
    n => println!("Got {} (other)", n),
}
```

## while let and if let

```rust
let mut stack = vec![1, 2, 3];
while let Some(top) = stack.pop() {
    println!("{}", top);  // 3, 2, 1
}

if let Some(value) = some_option {
    println!("Got: {}", value);
}
```

## matches! Macro

Quickly check if a value matches a pattern:

```rust
let x = 'c';
assert!(matches!(x, 'a' | 'e' | 'i' | 'o' | 'u'));
```
