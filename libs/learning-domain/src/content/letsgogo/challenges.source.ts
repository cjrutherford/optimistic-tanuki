export interface CodeChallenge {
  id: string;
  lessonSlug: string;
  title: string;
  description: string;
  starterCode: string;
  expectedOutput?: string;
  validationPattern?: string;
  hints: string[];
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const challenges: CodeChallenge[] = [
  // TypeScript to Go Module
  {
    id: 'tsg-01',
    lessonSlug: 'type-system-comparison',
    title: 'Define Your First Struct',
    description:
      'Create a `User` struct with fields `ID` (int), `Name` (string), and `Email` (string). Return a User with ID=1, Name="Alice", Email="alice@example.com"',
    starterCode: `package main

import "fmt"

type User struct {
    // Define the User struct fields here
}

func main() {
    // Create and print a User
}`,
    expectedOutput: '{1 Alice alice@example.com}',
    hints: [
      'Use `type User struct { }` to define a struct',
      'Fields are defined as `FieldName FieldType`',
      'Create with `User{Field: value, ...}`',
    ],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'tsg-02',
    lessonSlug: 'type-system-comparison',
    title: 'Declare vs Assign',
    description:
      'Demonstrate the difference between := (short declaration) and = (assignment). Create a variable x with value 5 using :=, then change it to 10 using =. Print both values.',
    starterCode: `package main

import "fmt"

func main() {
    // Use := to declare and initialize x with 5
    
    fmt.Println("First value:", x)
    
    // Use = to assign x to 10
    
    fmt.Println("Second value:", x)
}`,
    expectedOutput: 'First value: 5\nSecond value: 10',
    hints: [
      'Use `x := 5` for short declaration (creates new variable)',
      'Use `x = 10` for assignment (changes existing variable)',
      'The difference: := declares, = assigns',
    ],
    points: 15,
    difficulty: 'medium',
  },
  {
    id: 'tsg-03',
    lessonSlug: 'type-system-comparison',
    title: 'Type Conversion',
    description:
      'Create a new type Age based on int. Create a variable of type Age with value 25. Then convert it to regular int and print the int value.',
    starterCode: `package main

import "fmt"

// Define Age as a new type based on int

type Age 

func main() {
    // Create a variable of type Age with value 25
    
    // Convert Age to int and print it
    
}`,
    expectedOutput: '25',
    validationPattern: '^25$',
    hints: [
      'Define: `type Age int` creates a new type',
      'Create: `var myAge Age = 25`',
      'Convert: `int(myAge)` converts Age to int',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'tsg-04',
    lessonSlug: 'type-system-comparison',
    title: 'Zero Values',
    description:
      'Declare variables of types int, string, bool, and *int without initializing them. Print their values to see Go zero values in action.',
    starterCode: `package main

import "fmt"

func main() {
    var i int
    var s string
    var b bool
    var p *int
    
    // Print all four variables
    
}`,
    expectedOutput: '0  false <nil>',
    hints: [
      'Use fmt.Println(i, s, b, p) to print all',
      'Zero values: int=0, string="", bool=false, pointer=nil',
      'Compare to JavaScript undefined/null behavior',
    ],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'tsg-05',
    lessonSlug: 'error-handling',
    title: 'Handle Errors Properly',
    description:
      'Create a `divide` function that takes two floats and returns (float64, error). Return an error if divisor is 0. In main, call divide(10, 0) and handle the error.',
    starterCode: `package main

import "fmt"

var ErrDivideByZero = // define error here

func divide(a, b float64) (float64, error) {
    // Implement division with error handling
}

func main() {
    result, err := divide(10, 0)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println("Result:", result)
}`,
    expectedOutput: 'Error: division by zero',
    hints: [
      'Use `errors.New("message")` to create errors',
      'Return `0, ErrDivideByZero` when divisor is 0',
      'Return `a/b, nil` when successful',
    ],
    points: 15,
    difficulty: 'medium',
  },

  // Quirks Module
  {
    id: 'q-01',
    lessonSlug: 'values-vs-pointers',
    title: 'Pointer Basics',
    description:
      'Create a `Person` struct with Name (string) and Age (int). Add a `Birthday()` method with a pointer receiver that increments Age. Call Birthday() on a Person and print the age.',
    starterCode: `package main

import "fmt"

type Person struct {
    Name string
    Age  int
}

// Add Birthday method with pointer receiver

func main() {
    p := Person{Name: "Alice", Age: 30}
    // Call Birthday() and print age
}`,
    expectedOutput: '31',
    hints: [
      'Use `(p *Person) Birthday()` for pointer receiver',
      'Call with `p.Birthday()` - Go auto-dereferences',
      'Access field with `p.Age++` inside method',
    ],
    points: 15,
    difficulty: 'medium',
  },
  {
    id: 'q-02',
    lessonSlug: 'slices-arrays-maps',
    title: 'Slice Operations',
    description:
      'Create a slice with make that has length 0 and capacity 5. Append numbers 1, 2, 3 to it. Print the slice, its length, and capacity.',
    starterCode: `package main

import "fmt"

func main() {
    // Create slice with make
    // Append 1, 2, 3
    // Print: slice, len, cap
}`,
    expectedOutput: '[1 2 3] 3 5',
    hints: [
      'Use `make([]int, 0, 5)` for pre-allocated slice',
      'Use `append(slice, value)` to add elements',
      'Print with `fmt.Println(slice, len(slice), cap(slice))`',
    ],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'q-03',
    lessonSlug: 'defer-panic-recover',
    title: 'Defer Magic',
    description:
      'Create a function that prints "First", then "Second", then "Third" using defer. Print each on its own line.',
    starterCode: `package main

import "fmt"

func main() {
    defer fmt.Println("Third")
    // Add two more defer statements
}`,
    expectedOutput: 'First\nSecond\nThird',
    hints: [
      'Use `defer` before statements to run at function end',
      'Deferred functions run in LIFO order (last in, first out)',
      'Order: First defer runs last',
    ],
    points: 10,
    difficulty: 'easy',
  },

  // Concurrency Module
  {
    id: 'c-01',
    lessonSlug: 'goroutines-101',
    title: 'Goroutine with WaitGroup',
    description:
      'Create a WaitGroup, add 3, launch 3 goroutines that each print "Done". Wait for all to complete, then print "All done!"',
    starterCode: `package main

import (
    "fmt"
    "sync"
)

func main() {
    var wg sync.WaitGroup
    
    // Launch 3 goroutines
    
    wg.Wait()
    fmt.Println("All done!")
}`,
    expectedOutput: 'All done!',
    validationPattern: 'All done!',
    hints: [
      'Use `wg.Add(1)` before each goroutine',
      'Use `defer wg.Done()` inside goroutine',
      'wg.Wait() blocks until counter is 0',
    ],
    points: 15,
    difficulty: 'medium',
  },
  {
    id: 'c-02',
    lessonSlug: 'channels',
    title: 'Channel Communication',
    description:
      'Create an unbuffered channel. Launch a goroutine that sends "Hello from goroutine" to the channel. Receive and print the message.',
    starterCode: `package main

import "fmt"

func main() {
    ch := make(chan string)
    
    // Launch goroutine that sends to channel
    
    // Receive and print
}`,
    expectedOutput: 'Hello from goroutine',
    hints: [
      'Use `ch <- value` to send',
      'Use `<-ch` to receive',
      'Sender blocks until receiver is ready',
    ],
    points: 15,
    difficulty: 'medium',
  },
  {
    id: 'c-03',
    lessonSlug: 'select-statement',
    title: 'Select Two Channels',
    description:
      'Create two channels. Send to ch1 after 10ms, ch2 after 20ms. Use select to receive whichever comes first and print it.',
    starterCode: `package main

import (
    "fmt"
    "time"
)

func main() {
    ch1 := make(chan string)
    ch2 := make(chan string)
    
    go func() {
        time.Sleep(10 * time.Millisecond)
        ch1 <- "ch1"
    }()
    
    go func() {
        time.Sleep(20 * time.Millisecond)
        ch2 <- "ch2"
    }()
    
    // Use select to receive first message
}`,
    expectedOutput: 'ch1',
    hints: [
      'Use `select { case msg := <-ch1: ... case msg := <-ch2: ... }`',
      'Select picks the first ready case',
      'If both ready, Go chooses randomly',
    ],
    points: 25,
    difficulty: 'hard',
  },

  // Parallelism Module
  {
    id: 'p-01',
    lessonSlug: 'waitgroup-mutex',
    title: 'Safe Counter with Mutex',
    description:
      'Create a Counter with a Mutex and an int value. Add an Increment() method that increments the value with lock. Run 1000 goroutines incrementing the counter concurrently. Print final count.',
    starterCode: `package main

import (
    "fmt"
    "sync"
)

type Counter struct {
    // Add mutex and value
}

func (c *Counter) Increment() {
    // Lock, increment, unlock
}

func main() {
    var wg sync.WaitGroup
    counter := Counter{}
    
    for i := 0; i < 1000; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            counter.Increment()
        }()
    }
    
    wg.Wait()
    fmt.Println(counter.value)
}`,
    expectedOutput: '1000',
    hints: [
      'Add `mu sync.Mutex` and `value int` to struct',
      'Use `c.mu.Lock()` and `defer c.mu.Unlock()`',
      'Increment with `c.value++` between lock/unlock',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'p-02',
    lessonSlug: 'sync-atomic',
    title: 'Atomic Counter',
    description:
      'Use atomic.AddInt64 to increment a counter from 1000 goroutines. Start at 0, print final value.',
    starterCode: `package main

import (
    "fmt"
    "sync"
    "sync/atomic"
)

func main() {
    var counter int64
    var wg sync.WaitGroup
    
    for i := 0; i < 1000; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            // Use atomic.AddInt64
        }()
    }
    
    wg.Wait()
    fmt.Println(counter)
}`,
    expectedOutput: '1000',
    hints: [
      'Use `atomic.AddInt64(&counter, 1)` to add atomically',
      'Import "sync/atomic" package',
      'No mutex needed - atomic operations are lock-free',
    ],
    points: 15,
    difficulty: 'medium',
  },

  // Testing Module
  {
    id: 't-01',
    lessonSlug: 'testing-package',
    title: 'Write Your First Test',
    description:
      'Write a test for an Add function that adds two integers. Test that Add(2, 3) returns 5.',
    starterCode: `package main

import "testing"

// Implement Add function and its test

func TestAdd(t *testing.T) {
    result := Add(2, 3)
    if result != 5 {
        t.Errorf("Add(2, 3) = %d; want 5", result)
    }
}`,
    expectedOutput: 'PASS',
    hints: [
      'Define `func Add(a, b int) int { return a + b }`',
      'Tests run with `go test`',
      'Use t.Errorf to report failures',
    ],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 't-02',
    lessonSlug: 'table-tests',
    title: 'Table-Driven Addition',
    description:
      'Write a table-driven test for Add with test cases: (1,2,3), (0,0,0), (-1,1,0), (10,20,30).',
    starterCode: `package main

import "testing"

func Add(a, b int) int {
    return a + b
}

func TestAddTable(t *testing.T) {
    tests := []struct {
        name string
        a, b int
        want int
    }{
        // Add test cases
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test each case
        })
    }
}`,
    expectedOutput: 'PASS',
    hints: [
      'Add test cases to the tests slice',
      'Use `tt.name`, `tt.a`, `tt.b`, `tt.want` in the test function',
      't.Run creates subtests',
    ],
    points: 15,
    difficulty: 'medium',
  },
  {
    id: 't-03',
    lessonSlug: 'benchmarks',
    title: 'Benchmark Addition',
    description:
      'Write a benchmark for Add that runs the operation. Use b.N for iteration.',
    starterCode: `package main

import "testing"

func Add(a, b int) int {
    return a + b
}

func BenchmarkAdd(b *testing.B) {
    for i := 0; i < b.N; i++ {
        Add(1, 2)
    }
}`,
    expectedOutput: 'PASS',
    hints: [
      'Benchmark functions start with `Benchmark`',
      'Use `b.N` to get number of iterations',
      'Run with `go test -bench=.`',
    ],
    points: 30,
    difficulty: 'hard',
  },

  // GC Module
  {
    id: 'gc-01',
    lessonSlug: 'escape-analysis',
    title: 'Stack vs Heap',
    description:
      'Create a function that returns a pointer to a local variable. This will escape to heap. Print the pointer address (non-zero).',
    starterCode: `package main

import "fmt"

func newInt() *int {
    i := 42
    return &i // i escapes to heap!
}

func main() {
    p := newInt()
    fmt.Println(*p)
}`,
    expectedOutput: '42',
    hints: [
      'Returning `&localVariable` causes escape',
      'Go compiler decides stack vs heap automatically',
      'Run with `-gcflags="-m"` to see escape info',
    ],
    points: 20,
    difficulty: 'medium',
  },

  // Web Services Module
  {
    id: 'w-01',
    lessonSlug: 'net-http-basics',
    title: 'Simple HTTP Handler',
    description:
      'Create an HTTP server that responds to "/" with "Hello, World!" on port 8080. (Just print what would be served, validation is the handler)',
    starterCode: `package main

import (
    "fmt"
    "net/http"
)

func hello(w http.ResponseWriter, r *http.Request) {
    // Write "Hello, World!" to w
}

func main() {
    http.HandleFunc("/", hello)
    fmt.Println("Server would start on :8080")
    // Don't call ListenAndServe in playground
}`,
    expectedOutput: 'Server would start on :8080',
    hints: [
      'Use `w.Write([]byte("Hello, World!"))`',
      'http.HandleFunc registers a handler',
      'Handler receives ResponseWriter and Request',
    ],
    points: 15,
    difficulty: 'medium',
  },

  // Stdlib Module
  {
    id: 's-01',
    lessonSlug: 'fmt-strings-strconv',
    title: 'String Manipulation',
    description:
      'Use strings.Contains to check if "Hello World" contains "World". Print "found" if true, "not found" if false.',
    starterCode: `package main

import (
    "fmt"
    "strings"
)

func main() {
    s := "Hello World"
    if strings.Contains(s, "World") {
        fmt.Println("found")
    } else {
        fmt.Println("not found")
    }
}`,
    expectedOutput: 'found',
    hints: [
      'Import "strings" package',
      'Use `strings.Contains(haystack, needle)`',
      'Returns true if substring exists',
    ],
    points: 10,
    difficulty: 'easy',
  },

  // Packages Module
  {
    id: 'pkg-01',
    lessonSlug: 'web-frameworks',
    title: 'Gin Route',
    description:
      'Write code that would set up a Gin router with a GET /ping endpoint returning JSON {"message": "pong"}. (Just show the setup)',
    starterCode: `package main

import "github.com/gin-gonic/gin"

func main() {
    r := gin.Default()
    
    r.GET("/ping", func(c *gin.Context) {
        c.JSON(200, gin.H{
            "message": "pong",
        })
    })
    
    // Would run: r.Run()
    println("Gin server configured")
}`,
    expectedOutput: 'Gin server configured',
    hints: [
      'Use `gin.Default()` or `gin.New()` to create router',
      'Use `r.GET(path, handler)` for GET routes',
      'Use `c.JSON(status, object)` to return JSON',
    ],
    points: 15,
    difficulty: 'medium',
  },

  // Polish Module
  {
    id: 'pol-01',
    lessonSlug: 'profiling',
    title: 'CPU Profile Setup',
    description:
      'Set up code that would enable pprof for CPU profiling. Create a profile file and start CPU profiling.',
    starterCode: `package main

import (
    "os"
    "runtime/pprof"
)

func main() {
    // Create CPU profile file
    f, _ := os.Create("cpu.prof")
    defer f.Close()
    
    // Start CPU profiling
    pprof.StartCPUProfile(f)
    defer pprof.StopCPUProfile()
    
    println("CPU profiling configured")
}`,
    expectedOutput: 'CPU profiling configured',
    hints: [
      'Use `pprof.StartCPUProfile(file)`',
      'Use `defer pprof.StopCPUProfile()` to stop',
      'View with: `go tool pprof cpu.prof`',
    ],
    points: 25,
    difficulty: 'hard',
  },

  // Additional Challenges for TypeScript to Go Module
  {
    id: 'tsg-06',
    lessonSlug: 'zero-values',
    title: 'Explore Zero Values',
    description:
      'Declare variables of type int, string, bool, float64, and []int without initialization. Print their zero values.',
    starterCode: `package main

import "fmt"

func main() {
    var (
        i int
        s string
        b bool
        f float64
        slice []int
    )
    
    // Print all zero values
}`,
    expectedOutput: '0 false 0 []',
    hints: [
      'Zero values: int=0, string="", bool=false, float64=0.0, slice=nil',
      'Use fmt.Println(i, s, b, f, slice)',
      'Compare to JavaScript undefined behavior',
    ],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'tsg-07',
    lessonSlug: 'error-handling',
    title: 'Custom Error Types',
    description:
      'Create a custom error type with an Is method. Implement a function that returns this error when a value is negative.',
    starterCode: `package main

import "errors"
import "fmt"

type NegativeError struct {
    Value int
}

func (e NegativeError) Error() string {
    return fmt.Sprintf("negative value: %d", e.Value)
}

func (e NegativeError) Is(target error) bool {
    return target == errors.New("negative")
}

func checkPositive(n int) (int, error) {
    // Return error if n < 0
}

func main() {
    _, err := checkPositive(-5)
    fmt.Println(err)
}`,
    expectedOutput: 'negative value: -5',
    hints: [
      'Implement the Error() method for custom errors',
      'Return (0, NegativeError{Value: n}) when negative',
      'Use errors.Is() to check error types',
    ],
    points: 20,
    difficulty: 'medium',
  },

  // Additional Challenges for GC Module
  {
    id: 'gc-02',
    lessonSlug: 'how-gc-works',
    title: 'GC Triggers',
    description:
      'Allocate many objects to trigger GC. Print GC stats using runtime/debug.FreeOSMemory.',
    starterCode: `package main

import (
    "fmt"
    "runtime"
    "runtime/debug"
)

func main() {
    // Allocate 1000 objects
    for i := 0; i < 1000; i++ {
        _ = make([]byte, 1000)
    }
    
    // Force GC
    runtime.GC()
    debug.FreeOSMemory()
    
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    
    fmt.Printf("Allocated: %d bytes\\n", m.Alloc)
}`,
    expectedOutput: 'Allocated:',
    validationPattern: 'Allocated:',
    hints: [
      'runtime.GC() triggers garbage collection',
      'runtime.ReadMemStats() reads memory statistics',
      'm.Alloc shows currently allocated bytes',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'gc-03',
    lessonSlug: 'gc-friendly-code',
    title: 'Reduce Allocations',
    description:
      'Create a function that builds a string using + operator (bad), then rewrite to use strings.Builder (good). Print both results.',
    starterCode: `package main

import (
    "fmt"
    "strings"
)

func buildBad(words []string) string {
    s := ""
    for _, w := range words {
        s += w + " "
    }
    return s
}

func buildGood(words []string) string {
    // Use strings.Builder
    var b strings.Builder
    for _, w := range words {
        b.WriteString(w)
        b.WriteString(" ")
    }
    return b.String()
}

func main() {
    words := []string{"Hello", "World", "From", "Go"}
    fmt.Println(buildBad(words))
    fmt.Println(buildGood(words))
}`,
    expectedOutput: 'Hello World From Go',
    validationPattern: 'Hello World From Go',
    hints: [
      'strings.Builder uses less memory than string concatenation',
      'Use b.WriteString() to add strings',
      'Use b.String() to get final string',
    ],
    points: 25,
    difficulty: 'medium',
  },

  // Additional Challenges for Concurrency
  {
    id: 'c-04',
    lessonSlug: 'goroutines-101',
    title: 'Goroutine Leak Prevention',
    description:
      'Create a function that starts a goroutine but uses a done channel to allow cancellation. Send on done after 1ms.',
    starterCode: `package main

import (
    "fmt"
    "time"
)

func work(done chan<- bool) {
    // Do some work
    time.Sleep(10 * time.Millisecond)
    done <- true
}

func main() {
    done := make(chan bool)
    
    go work(done)
    
    select {
    case <-done:
        fmt.Println("Work completed")
    case <-time.After(1 * time.Millisecond):
        fmt.Println("Timed out - would cancel")
    }
}`,
    expectedOutput: 'Timed out',
    validationPattern: 'Timed out',
    hints: [
      'Use a done channel for cancellation',
      'select with <-time.After() for timeout',
      'Check done channel in worker',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'c-05',
    lessonSlug: 'channels',
    title: 'Buffered Channel',
    description:
      'Create a buffered channel with capacity 3. Send 3 values without receiving. Print "Sent all" after.',
    starterCode: `package main

import "fmt"

func main() {
    ch := make(chan string, 3)
    
    ch <- "first"
    ch <- "second"
    ch <- "third"
    
    // Check if channel is full
    if len(ch) == cap(ch) {
        fmt.Println("Sent all 3 values")
    }
}`,
    expectedOutput: 'Sent all 3 values',
    hints: [
      'make(chan T, capacity) creates buffered channel',
      'len(ch) = number of items in queue',
      'cap(ch) = total capacity',
    ],
    points: 15,
    difficulty: 'easy',
  },

  // Additional Challenges for Testing
  {
    id: 't-04',
    lessonSlug: 'testing-package',
    title: 'Test with Subtests',
    description:
      'Write a test with subtests for a Multiply function. Test 2*3=6, 0*5=0, -1*4=-4.',
    starterCode: `package main

import "testing"

func Multiply(a, b int) int {
    return a * b
}

func TestMultiply(t *testing.T) {
    tests := []struct {
        name string
        a, b int
        want int
    }{
        {"positive", 2, 3, 6},
        {"zero", 0, 5, 0},
        {"negative", -1, 4, -4},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := Multiply(tt.a, tt.b); got != tt.want {
                t.Errorf("Multiply(%d, %d) = %d; want %d", tt.a, tt.b, got, tt.want)
            }
        })
    }
}`,
    expectedOutput: 'PASS',
    hints: [
      'Use t.Run() for subtests',
      'Each subtest gets a clean slate',
      'Use table-driven approach',
    ],
    points: 15,
    difficulty: 'medium',
  },

  // Additional Challenges for Web Services
  {
    id: 'w-02',
    lessonSlug: 'rest-apis',
    title: 'JSON Response',
    description:
      'Create an HTTP handler that returns a JSON response with status 201 Created.',
    starterCode: `package main

import (
    "encoding/json"
    "net/http"
)

type Response struct {
    Message string
    Status  int
}

func handler(w http.ResponseWriter, r *http.Request) {
    resp := Response{
        Message: "Created",
        Status:  201,
    }
    
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(201)
    json.NewEncoder(w).Encode(resp)
}

func main() {
    http.HandleFunc("/create", handler)
    println("Handler registered at /create")
}`,
    expectedOutput: 'Handler registered',
    validationPattern: 'Handler registered',
    hints: [
      'Use w.Header().Set() for headers',
      'Use w.WriteHeader() before writing body',
      'Use json.NewEncoder(w).Encode() for JSON',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'w-03',
    lessonSlug: 'middleware',
    title: 'Logging Middleware',
    description:
      'Create a middleware function that logs the request method and URL before calling the handler.',
    starterCode: `package main

import (
    "fmt"
    "net/http"
)

func loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Log the request
        fmt.Printf("%s %s\\n", r.Method, r.URL.Path)
        
        // Call the next handler
        next.ServeHTTP(w, r)
    })
}

func hello(w http.ResponseWriter, r *http.Request) {
    w.Write([]byte("Hello"))
}

func main() {
    handler := loggingMiddleware(http.HandlerFunc(hello))
    println("Middleware configured")
}`,
    expectedOutput: 'Middleware configured',
    validationPattern: 'Middleware configured',
    hints: [
      'Middleware returns http.Handler',
      'Use next.ServeHTTP(w, r) to call next handler',
      'Access r.Method and r.URL.Path',
    ],
    points: 20,
    difficulty: 'medium',
  },

  // Additional Challenges for Stdlib
  {
    id: 's-02',
    lessonSlug: 'encoding-packages',
    title: 'JSON Marshal',
    description:
      'Marshal a struct to JSON and print it. Include fields: Name (string), Age (int), Active (bool).',
    starterCode:
      'package main\n\nimport (\n    "encoding/json"\n    "fmt"\n)\n\ntype User struct {\n    Name   string `json:"name"`\n    Age    int    `json:"age"`\n    Active bool   `json:"active"`\n}\n\nfunc main() {\n    u := User{Name: "Alice", Age: 30, Active: true}\n    \n    data, _ := json.Marshal(u)\n    fmt.Println(string(data))\n}',
    expectedOutput: '{"name":"Alice","age":30,"active":true}',
    hints: [
      'Use json.Marshal() to convert to JSON',
      'Use field tags: json:"fieldname"',
      'Use string(data) to convert []byte to string',
    ],
    points: 15,
    difficulty: 'easy',
  },
  {
    id: 's-03',
    lessonSlug: 'net-http-context',
    title: 'Context Timeout',
    description:
      'Create an HTTP handler that uses context.WithTimeout to limit request duration to 100ms.',
    starterCode: `package main

import (
    "context"
    "fmt"
    "net/http"
    "time"
)

func handler(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 100*time.Millisecond)
    defer cancel()
    
    select {
    case <-time.After(200 * time.Millisecond):
        w.Write([]byte("done"))
    case <-ctx.Done():
        fmt.Println("Request timed out")
    }
}

func main() {
    http.HandleFunc("/slow", handler)
    println("Timeout handler configured")
}`,
    expectedOutput: 'Timeout handler configured',
    validationPattern: 'Timeout handler configured',
    hints: [
      'Use context.WithTimeout() for deadlines',
      'ctx.Done() returns channel when timeout',
      'Always defer cancel()',
    ],
    points: 25,
    difficulty: 'hard',
  },

  // Additional Challenges for Packages
  {
    id: 'pkg-02',
    lessonSlug: 'orms-db',
    title: 'SQL Query',
    description:
      'Write Go code that would execute a SQL query using database/sql. Select name from users where id = 1.',
    starterCode: `package main

import (
    "database/sql"
    "fmt"
    
    _ "github.com/mattn/go-sqlite3"
)

func main() {
    // Assume db is initialized
    var db *sql.DB
    // db, _ := sql.Open("sqlite3", "app.db")
    
    var name string
    err := db.QueryRow("SELECT name FROM users WHERE id = ?", 1).Scan(&name)
    
    if err != nil {
        fmt.Println("Error:", err)
    } else {
        fmt.Println("Found:", name)
    }
}`,
    expectedOutput: 'Error:',
    validationPattern: 'Error:',
    hints: [
      'Use db.QueryRow() for single row queries',
      'Use .Scan() to extract values',
      'Always check for errors',
    ],
    points: 15,
    difficulty: 'medium',
  },
  {
    id: 'pkg-03',
    lessonSlug: 'utilities',
    title: 'Viper Config',
    description: 'Set up Viper to read a config value with a default fallback.',
    starterCode: `package main

import (
    "fmt"
    "github.com/spf13/viper"
)

func main() {
    // Set defaults
    viper.SetDefault("port", 8080)
    viper.SetDefault("debug", false)
    
    // Get with default
    port := viper.GetInt("port")
    debug := viper.GetBool("debug")
    
    fmt.Printf("Port: %d, Debug: %v\\n", port, debug)
}`,
    expectedOutput: 'Port: 8080, Debug: false',
    hints: [
      'viper.SetDefault() sets fallback values',
      'viper.GetInt(), viper.GetBool() for typed access',
      'Works with env vars, files, remote config',
    ],
    points: 15,
    difficulty: 'easy',
  },

  // Additional Challenges for Polish
  {
    id: 'pol-02',
    lessonSlug: 'security',
    title: 'Secure Headers',
    description:
      'Set secure HTTP headers using a custom middleware. Add X-Content-Type-Options and X-Frame-Options.',
    starterCode: `package main

import (
    "net/http"
)

func secureHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Add security headers
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        
        next.ServeHTTP(w, r)
    })
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("Secure!"))
    })
    
    handler := secureHeaders(mux)
    println("Secure headers middleware configured")
}`,
    expectedOutput: 'Secure headers middleware configured',
    validationPattern: 'Secure headers middleware configured',
    hints: [
      'X-Content-Type-Options: nosniff prevents MIME sniffing',
      'X-Frame-Options: DENY prevents clickjacking',
      'Add headers before calling next handler',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'pol-03',
    lessonSlug: 'deployment',
    title: 'Dockerfile',
    description:
      'Write a multi-stage Dockerfile for a Go application. Build in stage 1, run in stage 2 with distroless image.',
    starterCode: `package main

import "fmt"

func main() {
    // This represents a Dockerfile:
    // FROM golang:1.21 AS builder
    // WORKDIR /app
    // COPY . .
    // RUN go build -o main .
    //
    // FROM gcr.io/distroless/base
    // COPY --from=builder /app/main /
    // CMD ["/main"]
    
    fmt.Println("Multi-stage Dockerfile configured")
}`,
    expectedOutput: 'Multi-stage Dockerfile configured',
    hints: [
      'First stage: build the binary',
      'Second stage: use minimal image like distroless',
      'COPY --from=builder transfers the binary',
    ],
    points: 15,
    difficulty: 'medium',
  },

  // Basics Module - Hello World
  {
    id: 'b-01',
    lessonSlug: 'hello-world',
    title: 'Your First Go Program',
    description:
      'Write a Go program that prints "Hello, World!" to the console.',
    starterCode: `package main

import "fmt"

func main() {
    // Print "Hello, World!" to the console
    
}`,
    expectedOutput: 'Hello, World!',
    hints: [
      'Use fmt.Println() to print to console',
      'Make sure to include the newline character or use Println',
    ],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'b-02',
    lessonSlug: 'hello-world',
    title: 'Multiple Print Statements',
    description:
      'Print your name and favorite programming language on separate lines.',
    starterCode: `package main

import "fmt"

func main() {
    // Print your name on first line
    // Print your favorite language on second line
    
}`,
    expectedOutput: 'Alice\nGo',
    hints: [
      'Use fmt.Println() for each line',
      'Strings need to be in double quotes',
    ],
    points: 10,
    difficulty: 'easy',
  },

  // Basics Module - Variables & Types
  {
    id: 'b-03',
    lessonSlug: 'variables-types',
    title: 'Declare Variables',
    description:
      'Declare variables of type string, int, and bool, then print them all on one line separated by spaces.',
    starterCode: `package main

import "fmt"

func main() {
    // Declare name (string), age (int), and isStudent (bool)
    
    // Print all three variables
    
}`,
    expectedOutput: 'Alice 25 true',
    hints: [
      'Use var name string = "Alice"',
      'Use var age int = 25',
      'Use var isStudent bool = true',
    ],
    points: 15,
    difficulty: 'easy',
  },
  {
    id: 'b-04',
    lessonSlug: 'variables-types',
    title: 'Short Variable Declaration',
    description:
      'Use short variable declaration (:=) to create variables and print their values.',
    starterCode: `package main

import "fmt"

func main() {
    // Use := to create name, age, and balance
    
    fmt.Println(name, age, balance)
}`,
    expectedOutput: 'Bob 30 99.99',
    hints: ['Use name := "Bob"', 'Use age := 30', 'Use balance := 99.99'],
    points: 15,
    difficulty: 'easy',
  },
  {
    id: 'b-05',
    lessonSlug: 'variables-types',
    title: 'Type Conversion',
    description:
      'Convert an int to a string and concatenate it with another string.',
    starterCode: `package main

import "fmt"

func main() {
    age := 25
    // Use Sprintf to create "I am 25 years old"
    result := fmt.Sprintf("I am %d years old", age)
    fmt.Println(result)
}`,
    expectedOutput: 'I am 25 years old',
    hints: [
      'Use fmt.Sprintf() for formatting',
      'Use %d format specifier for integers',
    ],
    points: 20,
    difficulty: 'medium',
  },

  // Basics Module - Functions
  {
    id: 'b-06',
    lessonSlug: 'functions',
    title: 'Basic Function',
    description:
      'Write a function called greet that takes a string parameter and returns a greeting.',
    starterCode: `package main

import "fmt"

func greet(name string) string {
    // Return "Hello, [name]!"
    
}

func main() {
    result := greet("World")
    fmt.Println(result)
}`,
    expectedOutput: 'Hello, World!',
    hints: [
      'Use return "Hello, " + name + "!"',
      'In Go, string concatenation uses +',
    ],
    points: 15,
    difficulty: 'easy',
  },
  {
    id: 'b-07',
    lessonSlug: 'functions',
    title: 'Multiple Return Values',
    description:
      'Write a function that divides two numbers and returns both the result and any error.',
    starterCode: `package main

import "fmt"

func divide(a, b float64) (float64, error) {
    // Return a/b and nil for error
    
}

func main() {
    result, err := divide(10, 2)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Printf("Result: %.2f", result)
}`,
    expectedOutput: 'Result: 5.00',
    hints: [
      'Return multiple values with (result, error)',
      'Return a/b, nil when division succeeds',
    ],
    points: 20,
    difficulty: 'medium',
  },

  // Basics Module - Control Flow
  {
    id: 'b-08',
    lessonSlug: 'control-flow',
    title: 'If-Else Statement',
    description:
      'Write a function that checks if a number is positive, negative, or zero.',
    starterCode: `package main

import "fmt"

func checkNumber(n int) string {
    // Return "positive", "negative", or "zero"
    
}

func main() {
    fmt.Println(checkNumber(5))
    fmt.Println(checkNumber(-3))
    fmt.Println(checkNumber(0))
}`,
    expectedOutput: 'positive\nnegative\nzero',
    hints: [
      'Use if n > 0 { return "positive" }',
      'Use else if n < 0 { return "negative" }',
      'Use else { return "zero" }',
    ],
    points: 15,
    difficulty: 'easy',
  },

  // Sub-lesson Challenges - Basic Types
  {
    id: 'b-09',
    lessonSlug: 'basic-types',
    title: 'Integer Types',
    description:
      'Declare variables of type int, int8, and int16 with different values and print them.',
    starterCode: `package main

import "fmt"

func main() {
    var num8 int8 = 100
    var num16 int16 = 1000
    var num int = 100000
    
    fmt.Printf("%d %d %d", num8, num16, num)
}`,
    expectedOutput: '100 1000 100000',
    hints: [
      'int8 can store -128 to 127',
      'int16 can store -32768 to 32767',
      'int is platform dependent',
    ],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'b-10',
    lessonSlug: 'basic-types',
    title: 'Float Precision',
    description:
      'Demonstrate the difference between float32 and float64 precision.',
    starterCode: `package main

import "fmt"

func main() {
    pi64 := 3.14159265359
    pi32 := float32(pi64)
    
    fmt.Printf("%.8f\n", pi64)
    fmt.Printf("%.8f", pi32)
}`,
    expectedOutput: '3.14159265\n3.14159274',
    hints: [
      'float32 has ~7 significant digits of precision',
      'float64 has ~15 significant digits of precision',
      'Converting float64 to float32 loses precision',
    ],
    points: 15,
    difficulty: 'medium',
  },

  // Sub-lesson Challenges - Type Conversion
  {
    id: 'b-11',
    lessonSlug: 'type-conversion',
    title: 'String to Int',
    description: 'Convert the string "42" to an integer and add 8 to it.',
    starterCode: `package main

import (
    "fmt"
    "strconv"
)

func main() {
    s := "42"
    // Convert s to int and add 8
    
    fmt.Println(result)
}`,
    expectedOutput: '50',
    hints: [
      'Use strconv.Atoi() to convert string to int',
      'Handle the error if conversion fails',
    ],
    points: 15,
    difficulty: 'easy',
  },
  {
    id: 'b-12',
    lessonSlug: 'type-conversion',
    title: 'Int to String',
    description:
      'Convert the number 123 to a string and concatenate with "ABC".',
    starterCode: `package main

import (
    "fmt"
    "strconv"
)

func main() {
    num := 123
    // Convert num to string and concatenate with "ABC"
    
    fmt.Println(result)
}`,
    expectedOutput: 'ABC123',
    hints: [
      'Use strconv.Itoa() to convert int to string',
      'Use + for string concatenation',
    ],
    points: 15,
    difficulty: 'easy',
  },

  // Sub-lesson Challenges - Custom Types
  {
    id: 'b-13',
    lessonSlug: 'custom-types',
    title: 'Custom Type Methods',
    description:
      'Create a Counter type with an Increment method and print the result.',
    starterCode: `package main

import "fmt"

type Counter int

func (c Counter) Increment() Counter {
    // Increment c and return new value
    
}

func main() {
    var c Counter = 5
    c = c.Increment()
    fmt.Println(c)
}`,
    expectedOutput: '6',
    hints: [
      'Define method with (c Counter) receiver',
      'Return c + 1 cast to Counter',
    ],
    points: 20,
    difficulty: 'medium',
  },

  // Sub-lesson Challenges - If/Else
  {
    id: 'b-14',
    lessonSlug: 'if-else',
    title: 'Even or Odd',
    description:
      'Write a function that returns "even" if a number is even, or "odd" if odd.',
    starterCode: `package main

import "fmt"

func isEven(n int) string {
    // Return "even" or "odd"
    
}

func main() {
    fmt.Println(isEven(4))
    fmt.Println(isEven(7))
}`,
    expectedOutput: 'even\nodd',
    hints: ['Use n % 2 to check divisibility', 'If remainder is 0, it is even'],
    points: 10,
    difficulty: 'easy',
  },

  // Sub-lesson Challenges - Switch
  {
    id: 'b-15',
    lessonSlug: 'switch-statements',
    title: 'Day of Week',
    description:
      'Use a switch statement to return the day name for numbers 1-7.',
    starterCode: `package main

import "fmt"

func dayName(n int) string {
    // Return "Monday" to "Sunday" for 1-7, "Invalid" otherwise
    
}

func main() {
    fmt.Println(dayName(1))
    fmt.Println(dayName(5))
    fmt.Println(dayName(8))
}`,
    expectedOutput: 'Monday\nFriday\nInvalid',
    hints: ['Use switch n { case 1: ... }', 'Use default for invalid numbers'],
    points: 15,
    difficulty: 'easy',
  },

  // Sub-lesson Challenges - Loops
  {
    id: 'b-16',
    lessonSlug: 'loops',
    title: 'Sum with Loop',
    description: 'Use a for loop to calculate the sum of numbers 1 to 10.',
    starterCode: `package main

import "fmt"

func main() {
    sum := 0
    // Add numbers 1 through 10 to sum
    
    fmt.Println(sum)
}`,
    expectedOutput: '55',
    hints: ['Use for i := 1; i <= 10; i++', 'Add each i to sum'],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'b-17',
    lessonSlug: 'loops',
    title: 'Range Over Slice',
    description:
      'Use range to iterate over a slice and sum only the even numbers.',
    starterCode: `package main

import "fmt"

func main() {
    nums := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
    sum := 0
    // Use range to add only even numbers
    
    fmt.Println(sum)
}`,
    expectedOutput: '30',
    hints: ['Use for i, v := range nums', 'Check if v % 2 == 0'],
    points: 15,
    difficulty: 'medium',
  },

  // Sub-lesson Challenges - Package Declaration
  {
    id: 'b-18',
    lessonSlug: 'package-declaration',
    title: 'Library Package',
    description:
      'Create a package called "utils" with an Add function (just show the package declaration).',
    starterCode: `package main

// This challenge tests your understanding of package declarations
// In a real library, you'd put this in a separate file

func main() {
    // For this challenge, just print that you understand packages
    fmt.Println("I understand package declarations!")
}`,
    expectedOutput: 'I understand package declarations!',
    hints: ['package main for executables', 'package name for libraries'],
    points: 10,
    difficulty: 'easy',
  },

  // Sub-lesson Challenges - Import Statements
  {
    id: 'b-19',
    lessonSlug: 'import-statements',
    title: 'Multiple Imports',
    description:
      'Import fmt and strings packages and use them to print an uppercase string.',
    starterCode: `package main

import (
    "fmt"
    "strings"
)

func main() {
    s := "hello world"
    // Use strings.ToUpper to make s uppercase
    
    fmt.Println(result)
}`,
    expectedOutput: 'HELLO WORLD',
    hints: ['Use strings.ToUpper(s)', 'Print the result'],
    points: 10,
    difficulty: 'easy',
  },

  // Sub-lesson Challenges - Init Functions
  {
    id: 'b-20',
    lessonSlug: 'init-functions',
    title: 'Init Setup',
    description:
      'Use an init function to set an initial value, then print it in main.',
    starterCode: `package main

import "fmt"

var value int

func init() {
    // Set value to 42 in init
    
}

func main() {
    fmt.Println(value)
}`,
    expectedOutput: '42',
    hints: [
      'init() runs before main()',
      'Assign to the package-level variable',
    ],
    points: 15,
    difficulty: 'medium',
  },

  // Additional Challenges for Other Modules
  // Error Handling Sub-lessons
  {
    id: 'tsg-08',
    lessonSlug: 'error-handling',
    title: 'Error Type',
    description: 'Create a custom error using the error interface.',
    starterCode: `package main

import "fmt"

type MyError struct {
    msg string
}

func (e MyError) Error() string {
    return e.msg
}

func fail() error {
    // Return a MyError
    
}

func main() {
    err := fail()
    fmt.Println(err)
}`,
    expectedOutput: 'something went wrong',
    hints: [
      'Return MyError{msg: "something went wrong"}',
      'Implement Error() string method',
    ],
    points: 20,
    difficulty: 'medium',
  },

  // Defer Sub-lessons
  {
    id: 'q-04',
    lessonSlug: 'defer-panic-recover',
    title: 'Defer Basics',
    description: 'Use defer to print "world" before "hello" is printed.',
    starterCode: `package main

import "fmt"

func main() {
    defer fmt.Println("world")
    fmt.Println("hello")
}`,
    expectedOutput: 'hello\nworld',
    hints: [
      'defer runs after the surrounding function returns',
      'defer executes in LIFO order',
    ],
    points: 10,
    difficulty: 'easy',
  },

  // Select Sub-lessons
  {
    id: 'c-06',
    lessonSlug: 'select-statement',
    title: 'Basic Select',
    description: 'Use select to receive from one of two channels.',
    starterCode: `package main

import "fmt"

func main() {
    ch1 := make(chan string)
    ch2 := make(chan string)
    
    go func() { ch1 <- "from ch1" }()
    go func() { ch2 <- "from ch2" }()
    
    // Use select to receive from both (first one wins)
    for i := 0; i < 2; i++ {
        select {
        case msg1 := <-ch1:
            fmt.Println(msg1)
        case msg2 := <-ch2:
            fmt.Println(msg2)
        }
    }
}`,
    expectedOutput: 'from ch1\nfrom ch2',
    hints: [
      'select blocks until one case is ready',
      'Cases are evaluated simultaneously',
    ],
    points: 15,
    difficulty: 'medium',
  },

  // WaitGroup Sub-lessons
  {
    id: 'p-03',
    lessonSlug: 'waitgroup-mutex',
    title: 'WaitGroup Usage',
    description: 'Use WaitGroup to wait for 3 goroutines to complete.',
    starterCode: `package main

import (
    "fmt"
    "sync"
)

func main() {
    var wg sync.WaitGroup
    
    for i := 0; i < 3; i++ {
        wg.Add(1)
        go func(n int) {
            defer wg.Done()
            fmt.Println("Goroutine", n)
        }(i)
    }
    
    wg.Wait()
    fmt.Println("All done")
}`,
    expectedOutput: 'Goroutine 0\nGoroutine 1\nGoroutine 2\nAll done',
    hints: [
      'wg.Add(1) before each goroutine',
      'wg.Done() in each goroutine',
      'wg.Wait() blocks until counter is 0',
    ],
    points: 15,
    difficulty: 'medium',
  },

  // Benchmark Sub-lessons
  {
    id: 't-05',
    lessonSlug: 'benchmarks',
    title: 'Benchmark Function',
    description: 'Write a benchmark function that runs 1000 times.',
    starterCode: `package main

import "testing"

func BenchmarkHello(b *testing.B) {
    for i := 0; i < b.N; i++ {
        // This runs b.N times
    }
}`,
    expectedOutput: 'PASS',
    hints: [
      'Benchmark functions start with Benchmark',
      'b.N is the number of iterations',
    ],
    points: 10,
    difficulty: 'easy',
  },

  // Middleware Sub-lessons
  {
    id: 'w-04',
    lessonSlug: 'middleware',
    title: 'Basic Middleware',
    description: 'Create a simple logging middleware function.',
    starterCode: `package main

import "fmt"

func loggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // Log the request method and path
        fmt.Println(r.Method, r.URL.Path)
        next(w, r)
    }
}

func main() {
    handler := loggingMiddleware(func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintln(w, "Hello!")
    })
    // Note: This is conceptual - actual HTTP test would require net/http
    fmt.Println("Middleware created!")
}`,
    expectedOutput: 'Middleware created!',
    hints: [
      'Middleware takes a HandlerFunc and returns a HandlerFunc',
      'Call next(w, r) to pass control to the next handler',
    ],
    points: 15,
    difficulty: 'medium',
  },

  // Context Sub-lessons
  {
    id: 's-04',
    lessonSlug: 'net-http-context',
    title: 'Context With Value',
    description:
      'Store a value in a context and read it back, using an unexported key type rather than a string.',
    starterCode: `package main

import (
    "context"
    "fmt"
)

// An unexported key type. A plain string key would collide silently with
// other packages storing the same key on the same context.
type contextKey int

const userKey contextKey = iota

func main() {
    ctx := context.Background()
    ctx = context.WithValue(ctx, userKey, "alice")

    // Read the value back into 'user'. Use the comma-ok form so a missing
    // value is false rather than a panic.

    if !ok {
        fmt.Println("no user in context")
        return
    }
    fmt.Println(user)
}`,
    expectedOutput: 'alice',
    hints: [
      'ctx.Value(userKey) returns an any, so you need a type assertion',
      'user, ok := ctx.Value(userKey).(string)',
    ],
    points: 15,
    difficulty: 'easy',
  },

  // Structs
  {
    id: 'b-21',
    lessonSlug: 'structs',
    title: 'Declare a Struct',
    description:
      'Declare a Book struct with Title and Pages fields, then create one and print its title.',
    starterCode: `package main

import "fmt"

// Declare a Book struct with a Title string and a Pages int.


func main() {
    // Create a Book with the title "Dune" and 412 pages,
    // using field names rather than positional values.

    fmt.Println(b.Title)
}`,
    expectedOutput: 'Dune',
    hints: [
      'A struct declaration is `type Name struct { ... }`, with each field written as `FieldName FieldType`',
      'Build it with a composite literal that names each field: `Book{Title: ..., Pages: ...}`',
      'The title and page count are in the description above',
    ],
    points: 15,
    difficulty: 'easy',
  },
  {
    id: 'b-22',
    lessonSlug: 'structs',
    title: 'Value or Pointer Receiver',
    description:
      'One of these methods does nothing. Fix it so the discount is actually applied.',
    starterCode: `package main

import "fmt"

type Product struct {
    Name  string
    Price float64
}

// This method is meant to halve the price, but it does not work.
// The receiver gets a copy, so the write is thrown away on return.
// Change it so the change sticks.
func (p Product) Discount() {
    p.Price = p.Price / 2
}

func main() {
    item := Product{Name: "Desk", Price: 200}
    item.Discount()
    fmt.Println(item.Price)
}`,
    expectedOutput: '100',
    hints: [
      'A value receiver operates on a copy of the struct',
      'Change (p Product) to (p *Product) so the method has the original',
      'You do not need to change the call: Go takes the address for you',
    ],
    points: 25,
    difficulty: 'medium',
  },
  {
    id: 'b-23',
    lessonSlug: 'structs',
    title: 'Embedding',
    description:
      'Embed one struct in another and call the promoted method on the outer type.',
    starterCode: `package main

import "fmt"

type Engine struct {
    Horsepower int
}

func (e Engine) Start() string {
    return "engine started"
}

type Car struct {
    // Embed Engine here, with no field name, so Car gets Start().

    Make string
}

func main() {
    c := Car{Engine: Engine{Horsepower: 300}, Make: "Saab"}

    // Call Start on c directly, not through c.Engine.
    fmt.Println(...)
}`,
    expectedOutput: 'engine started',
    hints: [
      'An embedded field is written as just the type name, with no field name',
      'Embedded methods are promoted, so c.Start() works',
    ],
    points: 20,
    difficulty: 'medium',
  },

  // Interfaces
  {
    id: 'b-24',
    lessonSlug: 'interfaces',
    title: 'Satisfy an Interface',
    description:
      'Give Square the method it needs to satisfy Shape. Nothing declares the relationship — the methods are the whole contract.',
    starterCode: `package main

import "fmt"

type Shape interface {
    Area() float64
}

type Square struct {
    Side float64
}

// Give Square an Area method so it satisfies Shape.
// Note that you do not write "implements" anywhere.


func main() {
    var s Shape = Square{Side: 4}
    fmt.Println(s.Area())
}`,
    expectedOutput: '16',
    hints: ['func (s Square) Area() float64 { ... }', 'Return s.Side * s.Side'],
    points: 20,
    difficulty: 'easy',
  },
  {
    id: 'b-25',
    lessonSlug: 'interfaces',
    title: 'Type Switch',
    description:
      'Write a function that reports what type it was given, using a type switch.',
    starterCode: `package main

import "fmt"

func describe(v any) string {
    // Return "int" for an int, "string" for a string,
    // and "other" for anything else.

}

func main() {
    fmt.Println(describe(42))
    fmt.Println(describe("hi"))
    fmt.Println(describe(3.5))
}`,
    expectedOutput: 'int\nstring\nother',
    hints: [
      'switch v.(type) { case int: ... }',
      'The default case handles everything you did not list',
    ],
    points: 25,
    difficulty: 'medium',
  },
  {
    id: 'b-26',
    lessonSlug: 'interfaces',
    title: 'The Nil Interface Trap',
    description:
      'This program reports a failure that never happened. Work out why, and fix it.',
    starterCode: `package main

import "fmt"

type ValidationError struct{}

func (e *ValidationError) Error() string { return "invalid" }

// This is meant to report success, but the caller sees a failure.
// An interface is nil only when its type AND its value are empty,
// and returning a typed nil pointer leaves the type half filled in.
func validate(ok bool) error {
    var err *ValidationError
    if !ok {
        err = &ValidationError{}
    }
    return err
}

func main() {
    if err := validate(true); err != nil {
        fmt.Println("failed:", err)
    } else {
        fmt.Println("passed")
    }
}`,
    expectedOutput: 'passed',
    hints: [
      'The returned interface holds (*ValidationError, nil), which is not nil',
      'Return the literal nil on the success path rather than a typed nil pointer',
      'Restructure validate so it returns &ValidationError{} or nil directly',
    ],
    points: 30,
    difficulty: 'hard',
  },

  // Race conditions: this lesson had no exercise.
  {
    id: 'p-04',
    lessonSlug: 'race-conditions',
    title: 'Fix the Data Race',
    description:
      'Four goroutines increment a counter a thousand times each. The total should be 4000 and usually is not. Fix it.',
    starterCode: `package main

import (
    "fmt"
    "sync"
)

func main() {
    var wg sync.WaitGroup
    counter := 0

    // counter++ is three operations: read, add, write. Two goroutines
    // interleaving them lose an update, and nothing reports it.
    //
    // Guard the increment with a sync.Mutex. Lock before touching the
    // counter and unlock after, so only one goroutine is inside at a time.

    for i := 0; i < 4; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for j := 0; j < 1000; j++ {
                counter++
            }
        }()
    }

    wg.Wait()
    fmt.Println(counter)
}`,
    expectedOutput: '4000',
    hints: [
      'Declare a var mu sync.Mutex alongside the counter',
      'mu.Lock() before counter++ and mu.Unlock() after',
      'defer mu.Unlock() works too, but inside the inner loop, not the goroutine',
      'Run it with `go run -race .` to see the detector name the conflict',
      'sync/atomic is the other answer here, and atomic.AddInt64 is faster for a single counter',
    ],
    points: 30,
    difficulty: 'hard',
  },

  // Packages and imports: the overview lesson had no exercise of its own.
  {
    id: 'b-27',
    lessonSlug: 'packages-imports',
    title: 'Exported or Not',
    description:
      'In Go, capitalisation decides visibility. Fix the names so the program compiles and prints what it should.',
    starterCode: `package main

import (
    "fmt"
    "strings"
)

// Go has no public or private keyword. An identifier starting with a
// capital letter is exported and visible to other packages; a lowercase
// one is not. Inside a single package everything is reachable either way,
// but the convention still tells a reader what is meant to be used.

// This helper is meant to be part of the package's public surface.
// Rename it so it is exported.
func shout(text string) string {
    return strings.ToUpper(text) + "!"
}

// This one is an internal detail and should stay unexported.
// Rename it so it is not exported.
func Trim(text string) string {
    return strings.TrimSpace(text)
}

func main() {
    fmt.Println(Shout(trim("  hello  ")))
}`,
    expectedOutput: 'HELLO!',
    hints: [
      'Exported means the first letter is a capital: shout becomes Shout',
      'Unexported means it starts lowercase: Trim becomes trim',
      'main is calling Shout and trim already, so the names have to match',
      'strings.ToUpper and strings.TrimSpace are doing the actual work',
    ],
    points: 15,
    difficulty: 'easy',
  },
];

// Helper to get challenges for a lesson
export function getChallengesForLesson(lessonSlug: string): CodeChallenge[] {
  return challenges.filter((c) => c.lessonSlug === lessonSlug);
}

// Helper to get total possible points per module
export function getModulePoints(moduleId: string): number {
  const moduleLessonMap: Record<string, string[]> = {
    // These are lesson slugs, matching challenge.lessonSlug. They were once
    // written with a 'basics-' prefix that no challenge has ever used, which
    // made this module score zero.
    basics: [
      'hello-world',
      'variables-types',
      'functions',
      'control-flow',
      'packages-imports',
      'structs',
      'interfaces',
    ],
    'typescript-to-go': [
      'type-system-comparison',
      'zero-values',
      'error-handling',
    ],
    quirks: ['values-vs-pointers', 'slices-arrays-maps', 'defer-panic-recover'],
    gc: ['how-gc-works', 'escape-analysis', 'gc-friendly-code'],
    concurrency: ['goroutines-101', 'channels', 'select-statement'],
    parallelism: ['waitgroup-mutex', 'sync-atomic'],
    testing: ['testing-package', 'table-tests', 'benchmarks'],
    webservices: ['net-http-basics', 'rest-apis', 'middleware'],
    stdlib: ['fmt-strings-strconv', 'encoding-packages', 'net-http-context'],
    packages: ['web-frameworks', 'orms-db', 'utilities'],
    polish: ['profiling', 'security', 'deployment'],
  };

  const lessonSlugs = moduleLessonMap[moduleId] || [];
  return challenges
    .filter((c) => lessonSlugs.includes(c.lessonSlug))
    .reduce((sum, c) => sum + c.points, 0);
}

export const TOTAL_POINTS = challenges.reduce((sum, c) => sum + c.points, 0);
