# Enums in Rust

Enums in Rust are much more powerful than in most languages — variants can carry data!

## Basic Enums

```rust
enum Direction {
    North,
    South,
    East,
    West,
}

let dir = Direction::North;
```

## Enums with Data

Enum variants can hold different types and amounts of data:

```rust
enum Message {
    Quit,                       // no data
    Move { x: i32, y: i32 },   // struct-like
    Write(String),              // tuple-like
    ChangeColor(u8, u8, u8),   // tuple-like with multiple values
}
```

## The Option Enum

Rust has no `null`. Instead, it uses `Option<T>`:

```rust
enum Option<T> {
    Some(T),
    None,
}
```

```rust
let some_number: Option<i32> = Some(5);
let no_number: Option<i32> = None;

// You must handle both cases:
match some_number {
    Some(n) => println!("Got: {}", n),
    None    => println!("Nothing"),
}
```

## Pattern Matching with Enums

`match` is designed to work with enums:

```rust
fn describe_message(msg: Message) {
    match msg {
        Message::Quit => println!("Quit!"),
        Message::Move { x, y } => println!("Move to ({}, {})", x, y),
        Message::Write(text) => println!("Write: {}", text),
        Message::ChangeColor(r, g, b) => println!("Color: {},{},{}", r, g, b),
    }
}
```

## Methods on Enums

Enums can have methods too:

```rust
enum Coin {
    Penny,
    Nickel,
    Dime,
    Quarter,
}

impl Coin {
    fn value_in_cents(&self) -> u32 {
        match self {
            Coin::Penny   => 1,
            Coin::Nickel  => 5,
            Coin::Dime    => 10,
            Coin::Quarter => 25,
        }
    }
}
```

## if let

For matching a single pattern, `if let` is cleaner:

```rust
let config_max = Some(3u8);
if let Some(max) = config_max {
    println!("The maximum is configured to be {}", max);
}
```

> **Challenge**: Implement a function that calculates the area of a Shape enum.
