# Select Statement

The `select` statement lets you wait on multiple channel operations. It's like a switch, but for channels.

## Basic Select

```go
select {
case msg := <-ch1:
    fmt.Println("Received from ch1:", msg)
case msg := <-ch2:
    fmt.Println("Received from ch2:", msg)
}
```

## Waiting for Multiple Channels

```go
func main() {
    ch1 := make(chan string)
    ch2 := make(chan string)

    go func() {
        time.Sleep(100 * time.Millisecond)
        ch1 <- "from ch1"
    }()

    go func() {
        time.Sleep(200 * time.Millisecond)
        ch2 <- "from ch2"
    }()

    for i := 0; i < 2; i++ {
        select {
        case msg1 := <-ch1:
            fmt.Println(msg1)
        case msg2 := <-ch2:
            fmt.Println(msg2)
        }
    }
}
```

## Default Case

The default case executes if no channel is ready:

```go
select {
case msg := <-ch:
    fmt.Println(msg)
default:
    fmt.Println("No message ready")
}
```

### Non-blocking Send

```go
select {
case ch <- msg:
    fmt.Println("Sent!")
default:
    fmt.Println("Channel full, can't send")
}
```

## Timeout Pattern

```go
select {
case msg := <-ch:
    fmt.Println("Received:", msg)
case <-time.After(time.Second):
    fmt.Println("Timeout!")
}
```

With context:

```go
select {
case msg := <-ch:
    fmt.Println("Received:", msg)
case <-ctx.Done():
    fmt.Println("Cancelled:", ctx.Err())
}
```

## Break with Label

```go
outer:
    for {
        select {
        case <-done:
            break outer // Break out of outer loop
        case msg := <-ch:
            fmt.Println(msg)
        }
    }
```

## Random Selection

When multiple cases are ready, Go randomly selects one:

```go
ch1 := make(chan int)
ch2 := make(chan int)

go func() { ch1 <- 1 }()
go func() { ch2 <- 2 }()

select {
case <-ch1:
    fmt.Println("ch1")
case <-ch2:
    fmt.Println("ch2")
}
// Output is random!
```

## Practical Patterns

### Idle Connection Timeout

```go
// Go has no optional type. When a value might not be there, return a second
// bool saying whether it is, and let the caller check it.
func withTimeout(conn <-chan Request, timeout time.Duration) (Request, bool) {
    select {
    case req := <-conn:
        return req, true
    case <-time.After(timeout):
        var zero Request
        return zero, false
    }
}

// At the call site:
//   req, ok := withTimeout(conn, 5*time.Second)
//   if !ok {
//       return fmt.Errorf("no request within 5s")
//   }
```

### Graceful Shutdown

```go
func worker(jobs <-chan Job, results chan<- Result, done <-chan struct{}) {
    for {
        select {
        case job := <-jobs:
            results <- process(job)
        case <-done:
            // Drain jobs before exiting
            for job := range jobs {
                results <- process(job)
            }
            return
        }
    }
}
```

### Ticker for Heartbeat

```go
func heartbeat() {
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            fmt.Println("Heartbeat")
        case <-done:
            return
        }
    }
}
```

### Channel as mutex

```go
var (
    sem = make(chan struct{}, 1) // Binary semaphore
)

func critical() {
    sem <- struct{}{} // Acquire
    defer func() { <-sem }() // Release

    // Critical section
}
```

## Nil Channels

Sending/receiving from nil channel blocks forever - useful for disabling cases:

```go
var enabled bool
select {
case <-ch1: // If enabled, wait for ch1
    // ...
case <-time.After(time.Second): // If not enabled, timeout
    if !enabled {
        fmt.Println("ch1 disabled, timed out")
    }
}
```

## Common Mistakes

### Empty select

```go
select {} // Blocks forever!
```

### Forgetting default

```go
// This can deadlock if no one else is receiving!
ch := make(chan int)
<-ch // Blocks forever
```

### Using select in a loop

```go
for {
    select {
    case <-ch:
        // Handle single message
    }
    // Missing default = blocking
}
```

## Code Playground

Practice with different select patterns!
