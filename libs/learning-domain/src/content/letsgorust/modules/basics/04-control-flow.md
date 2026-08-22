# Control Flow in Rust

Rust has rich control flow constructs that are also expressions.

## if / else if / else

```rust
let number = 7;

if number < 0 {
    println!("negative");
} else if number == 0 {
    println!("zero");
} else {
    println!("positive");
}
```

### if as an Expression

In Rust, `if` is an expression and can produce a value:

```rust
let sign = if x > 0 { "positive" } else { "non-positive" };
```

Both branches must return the same type!

## loop, while, and for

```rust
// Infinite loop (use break to exit)
loop {
    println!("forever");
    break;
}

// while loop
let mut i = 0;
while i < 5 {
    println!("{}", i);
    i += 1;
}

// for loop (idiomatic Rust)
for i in 0..5 {    // 0, 1, 2, 3, 4
    println!("{}", i);
}

for i in 0..=5 {   // 0, 1, 2, 3, 4, 5
    println!("{}", i);
}
```

### Iterating Collections

```rust
let fruits = ["apple", "banana", "cherry"];
for fruit in &fruits {
    println!("{}", fruit);
}
```

## match

`match` is Rust's powerful pattern matching construct:

```rust
let coin = "quarter";
let value = match coin {
    "penny"    => 1,
    "nickel"   => 5,
    "dime"     => 10,
    "quarter"  => 25,
    _          => 0,  // wildcard — matches everything else
};
```

### Matching Multiple Patterns

```rust
let x = 3;
match x {
    1 | 2 => println!("one or two"),
    3..=5 => println!("three through five"),
    _     => println!("something else"),
}
```

### Destructuring in match

```rust
let pair = (0, -2);
match pair {
    (0, y) => println!("x is zero, y is {}", y),
    (x, 0) => println!("x is {}, y is zero", x),
    (x, y) => println!("x={}, y={}", x, y),
}
```

> **Challenge**: Implement FizzBuzz using control flow.
