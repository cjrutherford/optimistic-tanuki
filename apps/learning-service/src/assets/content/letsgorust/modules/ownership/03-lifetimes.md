# Lifetimes in Rust

Lifetimes are Rust's way of ensuring that references are always valid.

## What Are Lifetimes?

Every reference in Rust has a **lifetime** — the scope for which it is valid. Most of the time, Rust infers lifetimes automatically. But sometimes you need to be explicit.

## The Problem: Dangling References

```rust
// This would NOT compile:
fn dangle() -> &String {
    let s = String::from("hello");
    &s  // ERROR: s is dropped at end of function, reference would dangle!
}
```

## Lifetime Annotations

When a function returns a reference that depends on input references, you annotate lifetimes:

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

The `'a` annotation means: "the returned reference lives at least as long as both `x` and `y`."

```rust
fn main() {
    let s1 = String::from("long string");
    let result;
    {
        let s2 = String::from("xyz");
        result = longest(s1.as_str(), s2.as_str());
        println!("Longest: {}", result);  // OK — used within s2's scope
    }
}
```

## Lifetimes in Structs

Structs that hold references need lifetime annotations:

```rust
struct Important<'a> {
    part: &'a str,
}

fn main() {
    let novel = String::from("Call me Ishmael. Some years ago...");
    let first_sentence;
    {
        let i = novel.split('.').next().expect("no period");
        first_sentence = Important { part: i };
        println!("{}", first_sentence.part);
    }
}
```

## The 'static Lifetime

`'static` means the reference lives for the entire program:

```rust
let s: &'static str = "I have a static lifetime.";
```

String literals have `'static` lifetime because they're stored in the binary.

## Lifetime Elision Rules

Rust automatically infers lifetimes in common patterns (lifetime elision rules):

1. Each reference parameter gets its own lifetime parameter
2. If there's exactly one input lifetime, it's assigned to all outputs
3. If there's a `&self` or `&mut self` parameter, its lifetime is assigned to all outputs
