# Two Designs for "This Failed"

A function that can fail has to tell its caller somehow. Strip away the
syntax of every language you've used and there are really only two designs
for doing that: hand back a value that says "here's what happened, look at
it," or throw something and let the call stack unwind until code that knows
how to handle it catches it. Almost everything else in error handling
(`?`, `try`/`catch`, `if err != nil`, `Result`) is one of these two ideas
wearing a particular language's syntax.

---

## Design One: A Value the Caller Must Ask For

In this design, failure is just another possible return value. The function
returns normally (no special control flow) and the caller is responsible
for looking at what came back and deciding what it means.

```go
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, fmt.Errorf("division by zero")
    }
    return a / b, nil
}

result, err := divide(10, 0)
if err != nil {
    // handle it — nothing forces this, but nothing else will check for you
}
```

Nothing about calling `divide` looks different from calling a function that
can't fail. The failure is sitting right there in the return value,
indistinguishable in mechanism from the successful result: it's a second
value the language happens to also let you return. `letsgogo/modules/typescript-to-go/03-error-handling.md`
shows this pattern worked through end to end in Go: errors as ordinary
values, checked with an `if`, wrapped with `%w` to add context on the way
back up.

Rust's `Result<T, E>` is the same idea with the type system doing more of
the work: the compiler knows a `Result` isn't the value itself, and won't
let you use what's inside without acknowledging there might not be one.

---

## Design Two: An Object That Unwinds the Stack

In this design, failure isn't a return value at all. A function that fails
`throw`s an object, and control leaves that function immediately: no
return happens, the rest of the function's body never runs. The runtime
walks back up the call stack, frame by frame, looking for a `catch` block
that says it wants to handle this kind of failure. If it finds one, that's
where execution resumes. If it never finds one, the program terminates.

```cpp
double divide(double a, double b) {
    if (b == 0) {
        throw std::invalid_argument("division by zero");
    }
    return a / b;
}

try {
    double result = divide(10, 0);   // throws here — this line never finishes
    // this line never runs either
} catch (const std::invalid_argument& e) {
    // execution resumes here instead, however many frames up this is
}
```

The walking-back-up-the-stack part is not a metaphor: it's the mechanism.
`letsgocpp/modules/memory/04-exceptions.md` calls this "unwinding" and
points out what it actually does along the way: it runs the destructor of
every local object in every frame it passes through, which is why C++'s
RAII pattern and its exception design are described in that lesson as "the
same subject seen from opposite ends." A function three calls deep can
throw, and a `catch` block at the very top can handle it, having written
zero lines of code in the two frames in between.

---

## The Shape, Not the Syntax

Once you can name these as two designs rather than "how Go does it" and
"how C++ does it," you can recognize both wherever they show up, spelled
differently:

| Design                    | Go                                                                  | C++                             | Rust                                               | TypeScript                                |
| ------------------------- | ------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| Value the caller inspects | `(T, error)` return                                                 | `std::optional`/`std::expected` | `Result<T, E>`, `Option<T>`                        | manually, or a `Result`-like library type |
| Object that unwinds       | — (Go has `panic`/`recover`, reserved for unrecoverable situations) | `throw`/`catch`                 | `panic!` (unwinds, not meant for ordinary failure) | `throw`/`catch`                           |

Notice that most languages actually have _both_ mechanisms available, even
if their idioms lean hard on one. Go's `panic` unwinds the stack exactly
like a C++ exception does; it's simply reserved by convention for
situations the language considers unrecoverable rather than for ordinary
failures like a missing file. Rust's `panic!` plays the same reserved role
next to `Result`. The interesting design question, covered in the next
lesson, isn't "which mechanism does this language have" (most have both);
it's "which one does this language's ordinary, expected-failure code use by
default."

---

## Why This Split Is Worth Naming

The two designs fail differently when a caller does nothing:

1. A returned error, ignored, is just a value nobody looked at. The program
   keeps running with `err` sitting unread in a variable, and whatever
   `result` was computed alongside it (often a zero value) gets used as
   if it were valid.
2. A thrown exception, uncaught, keeps unwinding past every frame that
   didn't ask to handle it, and if it reaches the top with nobody having
   caught it, the program terminates.

Both of those are "the caller did nothing," and they produce opposite
failure modes: silent continuation with bad data, versus loud termination.
That contrast — what happens by default when nobody handles it — is exactly
what the next lesson weighs against each other.

---

## Neither Design Is About the Failure Itself

It's worth being precise about what each design actually governs, because
it's easy to mistake either one for a statement about how serious a failure
is. Neither `error` return values nor `throw` say anything about severity:
they only say how the information gets from the place that noticed the
problem to the place equipped to act on it. A returned `error` can carry
news as serious as "the disk is full." A thrown exception can carry
something as mundane as "this string wasn't a number," in a codebase that
happens to lean on exceptions for validation. The next lesson in this
module (on which category a given failure actually belongs to) is the one
that deals with severity. This lesson is only about the plumbing.

---

## Best Practices

1. Identify which design a function in front of you uses before assuming
   how its failures propagate
2. Remember most languages have both mechanisms; ask which one is
   idiomatic for _ordinary_ failure in this language, not which one exists
3. Read `panic!` in Rust and `panic` in Go as the same category as a C++
   exception — stack unwinding — reserved for cases the language doesn't
   expect you to routinely handle
4. When reading unfamiliar syntax for either design, ask "does this stop
   the function here and hand back a value, or does it leave immediately
   and go looking for a handler"
