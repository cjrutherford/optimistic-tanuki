# Structs in Rust

Structs let you create custom data types with named fields.

## Defining and Using Structs

```rust
struct User {
    username: String,
    email: String,
    age: u32,
    active: bool,
}

fn main() {
    let user = User {
        username: String::from("alice"),
        email: String::from("alice@example.com"),
        age: 30,
        active: true,
    };

    println!("User: {}", user.username);
}
```

## Methods with `impl`

Attach methods to a struct using `impl`:

```rust
struct Rectangle {
    width: f64,
    height: f64,
}

impl Rectangle {
    // Associated function (like a static method)
    fn new(width: f64, height: f64) -> Rectangle {
        Rectangle { width, height }
    }

    // Method (takes &self)
    fn area(&self) -> f64 {
        self.width * self.height
    }

    fn perimeter(&self) -> f64 {
        2.0 * (self.width + self.height)
    }

    fn is_square(&self) -> bool {
        self.width == self.height
    }
}

fn main() {
    let rect = Rectangle::new(5.0, 3.0);
    println!("Area: {}", rect.area());
    println!("Perimeter: {}", rect.perimeter());
    println!("Is square: {}", rect.is_square());
}
```

## Tuple Structs

Tuple structs are structs with unnamed fields:

```rust
struct Point(f64, f64);
struct Color(u8, u8, u8);

let origin = Point(0.0, 0.0);
let red = Color(255, 0, 0);

println!("x={}, y={}", origin.0, origin.1);
```

## Deriving Traits

Use `#[derive]` to automatically implement common traits:

```rust
#[derive(Debug, Clone, PartialEq)]
struct Point {
    x: f64,
    y: f64,
}

let p = Point { x: 1.0, y: 2.0 };
println!("{:?}", p);  // Point { x: 1.0, y: 2.0 }
```

## Struct Update Syntax

Create a new struct from an existing one:

```rust
let user2 = User {
    email: String::from("new@email.com"),
    ..user  // fill remaining fields from user
};
```

> **Challenge**: Implement a method on the `Rectangle` struct.
