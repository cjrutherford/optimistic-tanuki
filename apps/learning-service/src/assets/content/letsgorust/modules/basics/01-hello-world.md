# Hello World in Rust

Welcome to Rust! Let's start with the classic "Hello, World!" program.

## Your First Rust Program

```rust
fn main() {
    println!("Hello, World!");
}
```

Every Rust program starts with a `main` function — the entry point of your program.

## The `println!` Macro

Notice the `!` after `println` — this means it's a **macro**, not a regular function. Rust macros are powerful and work a bit differently from functions.

```rust
fn main() {
    println!("Hello, {}!", "Rustacean");  // Hello, Rustacean!
    println!("2 + 2 = {}", 2 + 2);       // 2 + 2 = 4
    println!("{:?}", vec![1, 2, 3]);      // [1, 2, 3]
}
```

The `{}` placeholder uses the `Display` trait to format values, while `{:?}` uses the `Debug` trait.

## Statements End with Semicolons

In Rust, statements must end with a semicolon (`;`). However, expressions that are used as return values should **not** have a semicolon.

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b  // No semicolon — this is the return value
}
```

## Compiling and Running

Rust is a compiled language. You compile with `rustc` or `cargo build`, then run the output binary.

```bash
rustc main.rs
./main
```

> **Challenge**: Modify the starter code to print "Hello, Rustacean!" instead of "Hello, World!".
