# Traits in Rust

Traits define shared behavior across types — similar to interfaces in other languages.

## Defining and Implementing Traits

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

struct Tweet {
    username: String,
    content: String,
}

impl Summary for Tweet {
    fn summarize(&self) -> String {
        format!("{}: {}", self.username, self.content)
    }
}
```

## Default Implementations

Traits can have default method implementations:

```rust
trait Greet {
    fn name(&self) -> &str;

    // Default implementation
    fn greet(&self) -> String {
        format!("Hello, {}!", self.name())
    }
}

struct Person { name: String }

impl Greet for Person {
    fn name(&self) -> &str {
        &self.name
    }
    // greet() uses the default implementation
}
```

## Trait Bounds

Use traits as generic constraints:

```rust
// Trait bound syntax
fn notify<T: Summary>(item: &T) {
    println!("Breaking news! {}", item.summarize());
}

// where clause (cleaner for complex bounds)
fn notify<T>(item: &T) where T: Summary + std::fmt::Debug {
    println!("{:?}: {}", item, item.summarize());
}
```

## Common Standard Traits

| Trait                | Purpose           | `#[derive]` |
| -------------------- | ----------------- | ----------- |
| `Debug`              | `{:?}` formatting | ✅          |
| `Display`            | `{}` formatting   | ❌ (manual) |
| `Clone`              | Deep copy         | ✅          |
| `Copy`               | Stack copy        | ✅          |
| `PartialEq` / `Eq`   | Equality          | ✅          |
| `PartialOrd` / `Ord` | Ordering          | ✅          |
| `Hash`               | Hashing           | ✅          |
| `Iterator`           | Iteration         | ❌ (manual) |

## Implementing Display

```rust
use std::fmt;

struct Matrix(f64, f64, f64, f64);

impl fmt::Display for Matrix {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "({}, {})\n({}, {})", self.0, self.1, self.2, self.3)
    }
}
```

## Trait Objects (Dynamic Dispatch)

Use `dyn Trait` for runtime polymorphism:

```rust
fn print_all(items: &[Box<dyn Summary>]) {
    for item in items {
        println!("{}", item.summarize());
    }
}
```

> **Challenge**: Implement a `Greet` trait for a `Person` struct.
