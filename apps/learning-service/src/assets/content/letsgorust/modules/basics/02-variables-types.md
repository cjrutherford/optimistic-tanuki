# Variables and Types in Rust

Rust is a statically typed language with powerful type inference.

## Declaring Variables

```rust
let x = 5;           // Rust infers the type as i32
let y: f64 = 3.14;   // Explicit type annotation
```

By default, variables in Rust are **immutable**. To make them mutable, use `mut`:

```rust
let mut count = 0;
count += 1;  // OK — count is mutable
```

## Basic Types

| Type     | Description             | Example              |
| -------- | ----------------------- | -------------------- |
| `i32`    | 32-bit signed integer   | `42`                 |
| `i64`    | 64-bit signed integer   | `1_000_000`          |
| `f32`    | 32-bit float            | `3.14_f32`           |
| `f64`    | 64-bit float            | `3.14`               |
| `bool`   | Boolean                 | `true`, `false`      |
| `char`   | Unicode character       | `'a'`, `'🦀'`        |
| `String` | Owned UTF-8 string      | `String::from("hi")` |
| `&str`   | String slice (borrowed) | `"hello"`            |

## Constants

Constants are always immutable and must have an explicit type:

```rust
const MAX_SCORE: u32 = 100;
const PI: f64 = 3.14159265358979;
```

## Shadowing

Rust allows you to **shadow** a variable by declaring a new one with the same name:

```rust
let x = 5;
let x = x + 1;   // x is now 6
let x = x * 2;   // x is now 12
```

This is different from mutation — shadowing can also change the type!

```rust
let spaces = "   ";
let spaces = spaces.len();  // spaces is now 3 (usize)
```

## Type Conversions

Rust does not do implicit type coercion. Use `as` for numeric conversions:

```rust
let x: i32 = 5;
let y: f64 = x as f64;
let z: i32 = 3.9_f64 as i32;  // truncates to 3
```

> **Challenge**: Declare a mutable variable and modify it.
