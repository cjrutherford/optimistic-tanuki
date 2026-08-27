# What Each One Costs You

Neither design from the last lesson is free. A returned value the caller
must inspect and a thrown object that unwinds the stack each solve "this
failed" by creating a different problem for you to manage. Neither one is
simply better: they trade one kind of pain for another, and being honest
about both sides is the point of this lesson.

---

## What Explicit Checking Costs

Returning failure as a value means every call site that can fail has to say
so, out loud, in code:

```go
resp, err := http.Get(url)
if err != nil {
    return nil, fmt.Errorf("fetching user: %w", err)
}
defer resp.Body.Close()

var user User
if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
    return nil, fmt.Errorf("decoding user: %w", err)
}
```

Two calls that can fail, two `if err != nil` blocks. That's the ceremony
cost, and it's real: the failure-handling code is often longer than the
happy-path code it's guarding, and it's repeated at every call site rather
than written once. What it buys in exchange is that the possibility of
failure is visible in the function signature and impossible to skim past:
`(*User, error)` tells you, before you've read a single line of the body,
that this can fail and you'll get something back either way.

The honest complication: explicit checking only forces handling if the
language, or something watching the language, actually enforces it. Go is
often described as making it impossible to ignore an error, and that
description overstates what the compiler does. `err` is an ordinary value.
The following compiles without complaint:

```go
resp, _ := http.Get(url)   // err discarded — this is fine syntax, just bad practice
useResponse(resp)          // resp may be nil; nothing stops this line from running
```

What actually stops this in most Go codebases isn't the compiler: it's a
linter (`errcheck`, `golangci-lint`, or similar) configured to flag a
discarded error, running in CI or an editor. That's a real and common
practice, but it's a tooling convention layered on top of the language, not
a guarantee the language itself makes. A codebase without that linter wired
in can silently drop errors exactly like the example above, and the
language will never object.

---

## What Exceptions Cost

An exception buys back the ceremony. The happy path reads like there's no
failure handling at all, because there isn't any at each call site: it's
concentrated wherever a `catch` block is written, which can be far away or
entirely absent:

```cpp
User fetchUser(int id) {
    auto response = httpGet(urlFor(id));   // might throw — nothing here says so
    return parseUser(response);             // might also throw
}

// somewhere far up the call stack:
try {
    User u = fetchUser(42);
    render(u);
} catch (const std::exception& e) {
    log(e.what());
}
```

`fetchUser`'s signature gives you no indication either call inside it can
fail. That's the cost on the other side of the trade: a failure can travel
silently past every frame that never considered it, because nothing in the
type system or the function signature requires a frame to acknowledge it
might be interrupted. C++ doesn't even require you to declare what a
function might throw: there's no equivalent of Java's `throws` clause
enforced by the compiler. Code three layers away from any `try` block can
be running inside the blast radius of an exception it has no way of knowing
about, and the only sign of that possibility is deciding to imagine every
call might not return normally.

That silence cuts both ways, though, and it's why exceptions persist as a
design rather than being an obvious mistake: it also means the ninety
frames of ordinary, non-failure-handling code between where an exception is
thrown and where it's caught don't have to write a single line acknowledging
it. The cost is paid once, centrally, wherever the `catch` sits, instead of
being paid at every intermediate call site the way `if err != nil` is.

---

## Laying Both Costs Side by Side

|                               | Explicit return value                                  | Thrown exception                                                 |
| ----------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| Happy-path readability        | Interrupted by handling code at every fallible call    | Clean: failure handling lives elsewhere                          |
| Visibility of "this can fail" | In the signature, if the language enforces checking it | Not in the signature in most languages; must be known or assumed |
| Cost of ignoring it           | Depends on tooling: see above                          | Uncaught: propagates until it terminates the program             |
| Where handling code lives     | At or near the call site                               | Concentrated at a `catch`, possibly far away                     |
| What a middle frame must do   | Explicitly pass the failure along                      | Nothing: it can be entirely unaware                              |

Neither column is free of surprises. The return-value design can hide a
silently discarded error behind an underscore. The exception design can let
a failure sail past a hundred frames that never imagined it, including
frames holding resources that now need to clean up correctly mid-flight —
which is precisely the problem `letsgocpp/modules/memory/04-exceptions.md`
describes RAII as solving: something has to guarantee cleanup happens during
that silent, unplanned exit, since no line of ordinary code was written to
request it.

---

## What This Means for Reading Someone Else's Code

When you land in a codebase using either design, the question to ask isn't
"is this a good choice" (both are defensible) it's "what does this
codebase actually do when the failure path is triggered, and what enforces
that anyone paid attention." For explicit returns: is there a linter making
"ignored error" a build failure, or is `_ = err` sitting uncaught somewhere?
For exceptions: is there a `catch (...)` at a sensible boundary (a request
handler, a `main`) or can an unhandled one reach the top and take the
process down?

---

## Best Practices

1. Don't credit a language with enforcing error handling until you've
   checked whether that enforcement is the compiler or a linter
2. When reading exception-based code, assume any call without a documented
   "cannot throw" guarantee might not return normally
3. Weigh ceremony against visibility deliberately — neither design removes
   the need to think about failure, they just move where you pay for it
4. Look for the boundary that catches everything (a top-level `catch`, a
   linter gate) before trusting that a codebase's chosen design is actually
   being enforced
