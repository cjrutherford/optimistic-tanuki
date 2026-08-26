# A Lifetime Decision, Not a Syntax One

Every value you create has to live somewhere, and "somewhere" is not just a
location: it's a lifetime. The stack and the heap are the two answers every
mainstream language gives, and the choice between them is really a choice
about when a value dies, made under a different name in every language you'll
touch.

---

## Two Places, Two Lifetimes

The **stack** is a contiguous region that grows and shrinks with function
calls. A value placed there is tied to the scope that created it: when that
scope ends, the value is gone, unconditionally, in the time it takes to move
a pointer.

The **heap** is a pool of memory with no built-in schedule. A value placed
there keeps existing until _something_ (a person, a compiler, or a
collector) decides it can go. That decision is the entire subject of this
lesson, because different languages hand it to different parties.

This is not an implementation footnote. It's the reason a function can
safely return a pointer to a heap value but never a pointer to a stack local,
in any language that has both: the stack value's scope has already ended by
the time the caller looks at it.

---

## Contrast One: C++ Decides Nothing For You

In C++, stack placement is the default and heap placement is something you
ask for explicitly, with `new`, and pay for explicitly, with `delete`.

```cpp
void example() {
    int x = 10;              // stack — dies when example() returns
    int* p = new int(42);    // heap — lives until someone deletes it

    delete p;                 // your job, and only your job
}
```

Nobody is coming to free `p` for you. If `example()` returns without calling
`delete`, that memory is leaked for the life of the program. `letsgocpp/modules/memory/01-stack-heap.md`
covers the mechanics (allocation, `delete[]`, dangling pointers) and its
own follow-up point matters as much as the mechanics: C++ has no escape
analysis in the sense Go or Java has it. `operator new` is replaceable, so
the compiler cannot generally decide on your behalf that a heap allocation
you wrote can become a stack one. In C++, you don't hope an allocation gets
optimized away: you decline to write it, by preferring a local, a
`std::array`, or a `std::vector` sized once.

---

## Contrast Two: Go Decides For You, at Compile Time

Go also has both a stack and a heap, but you rarely write the word
"heap": the compiler decides where a value goes by watching whether it
could possibly be used after its declaring function returns. That's escape
analysis.

```go
func add(a, b int) int {
    return a + b       // stays on the stack; nothing outlives the call
}

func newUser() *User {
    user := User{Name: "Alice"} // escapes to the heap
    return &user                // because a pointer to it survives the call
}
```

`letsgogo/modules/gc/02-escape-analysis.md` walks through the rules the
compiler applies (returning a pointer, sending one to a channel, a value too
large for the stack) and how to check its decisions with
`go build -gcflags="-m"`. The garbage collector then owns freeing whatever
escaped, on its own schedule, once nothing reachable points to it anymore.

The easy misreading here is "Go has a GC, so I don't need to think about
memory." That's wrong in a specific way: garbage collection changes _who_
frees a heap value and _when_: it does not change whether allocating one
costs anything. A function that forces values onto the heap needlessly still
pays for that allocation and adds work for the collector later, which is
exactly why the escape-analysis lesson exists as its own topic in the Go
course rather than being folded into "GC means it's automatic, move on."

---

## Contrast Three: Rust Decides at Compile Time, and Enforces It

Rust also puts stack placement by default and heap placement behind an
explicit type, but it adds a rule neither of the other two languages has:
the compiler tracks, for every heap value, exactly one variable that is
allowed to be responsible for freeing it, and refuses to compile code that
loses track of which one that is.

```rust
fn main() {
    let x = 10;                      // stack
    let s = String::from("hello");   // heap — s owns the allocation
}   // both are freed here, deterministically, no collector involved
```

Nothing runs concurrently to reclaim `s`; the compiler inserted the
equivalent of a `delete` at the closing brace, at the same point C++ would
have needed you to write one by hand, and verified there is no path where
that value is used after this point. The next lesson in this module goes
into where the "exactly one variable is responsible" rule comes from and
what it buys you.

---

## The Question Underneath All Three

Every one of these designs is answering the same question with a different
mechanism:

1. **Who decides where a value lives?** The programmer's declaration in
   C++, the compiler's escape analysis in Go, the compiler's ownership
   tracking in Rust.
2. **Who decides when a value dies?** The programmer, again, in C++; a
   collector running on its own schedule in Go; the compiler, at a
   provably-correct point, in Rust.
3. **What happens if that responsibility is dropped?** A leak in C++, a
   longer-lived object the collector eventually notices in Go, a compile
   error in Rust.

Once you can name which party is doing the deciding in a language, a whole
category of that language's quirks stops being arbitrary. Go's "return a
pointer and it just works" and Rust's "this value was moved" are the same
underlying fact (a value's lifetime outlived its original scope) reported
by two different enforcement mechanisms.

---

## Why the Stack Is Never the Slow Path

One thing all three languages agree on, silently: nobody optimizes by
moving a value from the heap to the stack after the fact, because the stack
was never the thing that needed optimizing. Its speed comes from having no
decision to make: allocating a stack frame is moving one pointer by a
known amount, computed at compile time, not searching for a free block the
way a general-purpose heap allocator does. That's true whether the language
in front of you frees heap memory by hand, by a collector, or by a
compiler-inserted drop. The lifetime question this lesson opened with —
what determines where a value lives determines when it dies — is really
asking which values _had_ to pay the heap's cost, because their lifetime
genuinely outran the scope that created them, versus which ones are paying
it because nobody asked the question.

---

## Best Practices

1. Ask "who decides where this lives, and who decides when it dies" for any
   language before you trust your intuition from another one
2. Remember that a garbage collector changes who frees memory, not whether
   allocating it is free
3. In C++, prefer not allocating at all over trusting the optimizer to
   remove an allocation you wrote
4. In Go, check escape decisions with `-gcflags="-m"` instead of guessing
5. In Rust, read a compile error about ownership as a lifetime question, not
   a syntax obstacle
