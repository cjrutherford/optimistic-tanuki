# Lifetimes in Rust

Lifetimes are Rust's way of ensuring that references are always valid.

## What Are Lifetimes?

Every reference in Rust has a **lifetime** — the scope for which it is valid. Most of the time, Rust infers lifetimes automatically. But sometimes you need to be explicit.

## The Problem: Dangling References

```rust
fn dangle() -> &String {
    let s = String::from("hello");
    &s
}
```

This does not compile, but it is worth being precise about why, because the
error you get is not the one most tutorials describe:

```text
error[E0106]: missing lifetime specifier
 --> src/lib.rs:1:16
  |
1 | fn dangle() -> &String {
  |                ^ expected named lifetime parameter
  |
  = help: this function's return type contains a borrowed value, but there is
          no value for it to be borrowed from
```

The compiler rejects the **signature**, before it looks at the body at all. A
returned reference has to borrow from something, and every borrow needs a
lifetime. Here there are no parameters, so there is nothing to borrow from and
nothing to infer a lifetime from. That is what "no value for it to be borrowed
from" means.

The dangling-reference story is the _second_ error, the one you reach if you
paper over the first:

```rust
fn dangle() -> &'static str {
    let s = String::from("hello");
    &s  // now the body is checked, and now it fails
}
```

```text
error[E0515]: cannot return reference to local variable `s`
  = note: returns a reference to data owned by the current function
```

Two different errors, at two different stages. E0106 says the signature does
not describe a valid borrow. E0515 says the borrow is described fine but the
data does not live long enough. Knowing which one you are looking at tells you
whether to fix the signature or the body.

The honest fix for this function is to return the `String` itself and move
ownership out, rather than lend a reference to something about to be dropped:

```rust
fn no_dangle() -> String {
    String::from("hello")
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
