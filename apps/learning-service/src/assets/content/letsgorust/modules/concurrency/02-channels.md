# Channels in Rust

Channels enable message passing between threads — "don't communicate by sharing memory; share memory by communicating."

## Basic Channel Usage

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    // mpsc = multiple producer, single consumer
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        tx.send("hello from thread").unwrap();
    });

    let received = rx.recv().unwrap();
    println!("Got: {}", received);
}
```

## Sending Multiple Values

```rust
let (tx, rx) = mpsc::channel();

thread::spawn(move || {
    let vals = vec!["one", "two", "three", "four"];
    for val in vals {
        tx.send(val).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
});

// rx acts like an iterator
for received in rx {
    println!("Got: {}", received);
}
```

## Multiple Producers

Clone the transmitter for multiple senders:

```rust
let (tx, rx) = mpsc::channel();
let tx2 = tx.clone();

thread::spawn(move || { tx.send("msg from t1").unwrap(); });
thread::spawn(move || { tx2.send("msg from t2").unwrap(); });

for msg in rx {
    println!("{}", msg);
}
```

## try_recv (Non-blocking)

```rust
use std::sync::mpsc::TryRecvError;

match rx.try_recv() {
    Ok(msg) => println!("Got: {}", msg),
    Err(TryRecvError::Empty) => println!("No message yet"),
    Err(TryRecvError::Disconnected) => println!("Channel closed"),
}
```

## Sending Complex Data

```rust
#[derive(Debug)]
enum WorkOrder {
    ProcessFile(String),
    Shutdown,
}

let (tx, rx) = mpsc::channel::<WorkOrder>();

thread::spawn(move || {
    while let Ok(order) = rx.recv() {
        match order {
            WorkOrder::ProcessFile(path) => println!("Processing: {}", path),
            WorkOrder::Shutdown => break,
        }
    }
});

tx.send(WorkOrder::ProcessFile("data.csv".to_string())).unwrap();
tx.send(WorkOrder::Shutdown).unwrap();
```

## sync_channel (Bounded)

```rust
use std::sync::mpsc;

// Buffer of 1 message — sender blocks when full
let (tx, rx) = mpsc::sync_channel(1);

thread::spawn(move || {
    tx.send(1).unwrap();
    println!("sent 1");
    tx.send(2).unwrap();  // blocks until rx reads
    println!("sent 2");
});

std::thread::sleep(std::time::Duration::from_secs(1));
println!("received {}", rx.recv().unwrap());
println!("received {}", rx.recv().unwrap());
```
