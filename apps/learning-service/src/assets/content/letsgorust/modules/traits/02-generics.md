# Generics in Rust

Generics allow you to write code that works with multiple types.

## Generic Functions

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

fn main() {
    let numbers = vec![34, 50, 25, 100, 65];
    println!("Largest: {}", largest(&numbers));

    let chars = vec!['y', 'm', 'a', 'q'];
    println!("Largest: {}", largest(&chars));
}
```

## Generic Structs

```rust
struct Pair<T> {
    first: T,
    second: T,
}

impl<T> Pair<T> {
    fn new(first: T, second: T) -> Self {
        Self { first, second }
    }
}

impl<T: PartialOrd + std::fmt::Display> Pair<T> {
    fn cmp_display(&self) {
        if self.first >= self.second {
            println!("First: {}", self.first);
        } else {
            println!("Second: {}", self.second);
        }
    }
}
```

## Generic Enums

`Option` and `Result` are generic enums in the standard library:

```rust
enum Option<T> { Some(T), None }
enum Result<T, E> { Ok(T), Err(E) }
```

## Multiple Type Parameters

```rust
struct KeyValue<K, V> {
    key: K,
    value: V,
}

let kv = KeyValue { key: "age", value: 30 };
```

## Monomorphization

Generics in Rust have **zero runtime cost** — the compiler generates specific code for each type used. This is called monomorphization.

```rust
// You write:
fn largest<T: PartialOrd>(list: &[T]) -> &T { ... }

// Compiler generates (roughly):
fn largest_i32(list: &[i32]) -> &i32 { ... }
fn largest_char(list: &[char]) -> &char { ... }
```

## const Generics

Generics can also be constants (useful for fixed-size arrays):

```rust
struct Matrix<const N: usize> {
    data: [[f64; N]; N],
}

impl<const N: usize> Matrix<N> {
    fn new() -> Self {
        Matrix { data: [[0.0; N]; N] }
    }
}

let m: Matrix<3> = Matrix::new();  // 3x3 matrix
```
