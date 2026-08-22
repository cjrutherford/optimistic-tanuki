# Channels

Channels are the pipes that connect concurrent goroutines. They allow you to send and receive values between goroutines.

## Creating Channels

```go
// Unbuffered channel
ch := make(chan int)

// Buffered channel
ch := make(chan int, 10)
```

## Sending and Receiving

```go
ch := make(chan int)

// Send (blocks until receiver ready)
ch <- 42

// Receive (blocks until sender ready)
value := <-ch
```

## Unbuffered vs Buffered

### Unbuffered

- Synchronous - sender blocks until receiver receives
- Guarantees delivery
- Good for rendezvous

```go
func main() {
    ch := make(chan string)

    go func() {
        ch <- "Hello!"
    }()

    msg := <-ch // Waits for message
    fmt.Println(msg)
}
```

### Buffered

- Asynchronous up to buffer size
- Sender blocks only when buffer is full
- Good when sender and receiver have different speeds

```go
ch := make(chan int, 100)

// Can send 100 items without receiving
for i := 0; i < 100; i++ {
    ch <- i
}
```

## Channel Directions

### Bidirectional (most common)

```go
ch := make(chan int)
```

### Send-only

```go
func producer(ch chan<- int) {
    ch <- 42 // Can only send
}
```

### Receive-only

```go
func consumer(ch <-chan int) {
    val := <-ch // Can only receive
}
```

## Closing Channels

```go
ch := make(chan int)

// Sender closes when done
close(ch)

// Receiver checks if open
val, ok := <-ch
if !ok {
    // Channel is closed
}
```

### Ranging over Channels

```go
ch := make(chan int, 5)
ch <- 1
ch <- 2
ch <- 3
close(ch)

for n := range ch {
    fmt.Println(n)
}
```

## Select with Channels

```go
select {
case msg := <-ch1:
    fmt.Println("Received:", msg)
case msg := <-ch2:
    fmt.Println("Received:", msg)
case <-time.After(time.Second):
    fmt.Println("Timeout!")
}
```

## Patterns

### Fan-out (multiple workers)

```go
func main() {
    jobs := make(chan int, 100)
    results := make(chan int, 100)

    // Start workers
    for w := 1; w <= 3; w++ {
        go worker(w, jobs, results)
    }

    // Send jobs
    for j := 1; j <= 9; j++ {
        jobs <- j
    }
    close(jobs)

    // Collect results
    for r := 1; r <= 9; r++ {
        <-results
    }
}

func worker(id int, jobs <-chan int, results chan<- int) {
    for j := range jobs {
        results <- j * 2
    }
}
```

### Fan-in (merging)

```go
func main() {
    ch1 := generator(1, 3)
    ch2 := generator(4, 6)
    merged := merge(ch1, ch2)

    for v := range merged {
        fmt.Println(v)
    }
}

func merge(chs ...<-chan int) <-chan int {
    var wg sync.WaitGroup
    merged := make(chan int)

    output := func(ch <-chan int) {
        defer wg.Done()
        for n := range ch {
            merged <- n
        }
    }

    wg.Add(len(chs))
    for _, ch := range chs {
        go output(ch)
    }

    go func() {
        wg.Wait()
        close(merged)
    }()

    return merged
}
```

## Nil Channels

Sending to nil channel blocks forever:

```go
var ch chan int // nil
ch <- 1 // Blocks forever!
```

Receiving from nil channel blocks forever:

```go
var ch chan int
<-ch // Blocks forever!
```

Useful for disabling cases in select:

```go
select {
case <-ch:
    // ...
case <-nilCh: // Never fires
    // This case is disabled!
}
```

## Best Practices

1. **Close channels from sender side** - receiver shouldn't close
2. **Use buffered channels** when you know capacity
3. **Check both value and ok** when receiving
4. **Don't send on closed channel** - panic!

## Code Playground

Experiment with channel patterns!
