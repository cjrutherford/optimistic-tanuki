# A Missing File and a Mistyped Number

Not every failure is the same kind of failure, and the most common mistake
in this whole area of language design (made by codebases, not just
beginners) is treating them as one category. A file that isn't where you
expected it, and a user who typed a letter into a field that wanted a
number, are both "something went wrong." They are not equally surprising,
and conflating them is where a lot of bad error-handling code comes from.

---

## The Distinction

An **exceptional** failure is one your code did not, and reasonably could
not, plan for as a routine outcome. The disk fills up mid-write. A
configuration file that should always exist has been deleted. A network
socket that was open a moment ago is suddenly gone. These are failures
about the _environment_ being wrong in a way your function's normal logic
has no sensible response to beyond stopping and reporting it.

An **expected** failure is a routine, anticipated outcome of doing the job
at all. A user types "abc" into a field expecting a number. A search
returns no results. A file that a "does this exist" check is specifically
there to ask about doesn't exist. Handling this outcome isn't a fallback:
it's part of the function's actual job description.

The tell is usually this: if you can describe the failure as one of the
_normal branches_ a correct implementation must have (right alongside the
success branch, not off to the side of it) it's expected. If handling it
sensibly means "log this and give up, because there is no local recovery,"
it's exceptional.

---

## What C++ Argues, Directly

`letsgocpp/modules/memory/04-exceptions.md` makes this argument on its own
terms, worth reading in full: "Exceptions are for the exceptional. A file
that is missing when you expected it is exceptional; a user typing a letter
into a number field is not, it is the normal case for input validation."
Its recommendation follows directly from that: use exceptions for the first
category, and for the second, return a value: since C++17,
`std::optional<T>` for "a value or nothing," and since C++23,
`std::expected<T, E>` for "a value or a reason it's missing." Both put the
possibility of failure in the function's return type, visible at the call
site, for a category of failure that a caller is expected to actually
handle rather than merely report.

```cpp
// Expected failure: the caller needs to act on "not a number," not just log it.
std::optional<int> parseAge(const std::string& input) {
    try {
        return std::stoi(input);
    } catch (...) {
        return std::nullopt;   // no exception escapes — this is a normal outcome
    }
}

if (auto age = parseAge(userInput)) {
    // *age is valid
} else {
    // show a validation message — this branch is not exceptional, it's routine
}
```

Notice the exception is still there internally (`std::stoi` throws on bad
input) but it's caught and converted at the boundary where "user typed
something wrong" stops being exceptional and becomes an expected outcome
the calling code is built to handle.

---

## What a Failing Function Should Also Tell You

The C++ lesson makes a second point that most fundamentals material skips
entirely, because it's usually treated as advanced: a function that can
fail should also say what state it leaves behind when it does. Three
levels, from weakest to strongest:

1. **Basic guarantee**: nothing leaks, every object involved is still in a
   valid state, but values may have changed from what they were before the
   call.
2. **Strong guarantee**: the operation either fully succeeds or changes
   nothing at all. A failed call leaves everything exactly as it found it.
3. **No-throw guarantee**: the operation cannot fail. Destructors, `swap`,
   and move operations are expected to reach this, because the strong
   guarantee for other operations is usually built out of a no-throw commit
   step.

```cpp
void Buffer::append(const std::vector<int>& more) {
    std::vector<int> candidate = data_;                          // may throw
    candidate.insert(candidate.end(), more.begin(), more.end());  // may throw
    data_.swap(candidate);   // cannot throw — this is the commit point
}
```

If either of the first two lines throws, `data_` was never touched: the
strong guarantee, built by doing the risky work on a copy and committing
with an operation that can't fail. This question ("if this fails, what
shape is everything left in") applies just as much to a function returning
`Result<T, E>` or `(T, error)` as it does to one that throws. A Go function
that returns a partially-modified struct alongside a non-nil error has the
same obligation to document as a C++ function that throws partway through a
multi-step operation: say what the caller can trust about the state they're
left holding.

---

## Applying the Split Outside C++

The expected/exceptional line matters regardless of which of the two
designs from the earlier lessons a language reaches for. A Go function that
returns `(int, error)` for a parse failure is treating that failure as
expected (the same category `std::optional` covers) using the
value-return design instead of the exception design. A Python function that
raises `ValueError` on bad input is treating the same failure as
exceptional in mechanism, even though the underlying situation (a user
typo) is exactly the routine case the C++ lesson calls out.

The mechanism a language reaches for by convention and the category a
specific failure actually belongs in are two different choices, and a
language's idiom doesn't always sort them the way this lesson would. That's
worth noticing rather than assuming every language's default is well-suited
to every failure you'll write.

---

## A Test for the Boundary

When a failure doesn't obviously sort itself, one question tends to settle
it: would you write a test case for this outcome as part of the function's
normal test suite, right next to the success case, or would you write it as
a separate "what happens when the environment is broken" test using mocks
and fault injection? A parser's "input wasn't a number" belongs in the same
table-driven test file as its "input was a number" case: it's a routine
branch of the same behavior. A database client's "connection dropped
mid-query" belongs in a different kind of test entirely, one built to
simulate an abnormal environment rather than exercise a normal input. If you
find yourself reaching for fault injection to exercise a case, that's a sign
it's exceptional; if the case falls out of ordinary input variation, it's
expected.

---

## Best Practices

1. Before writing failure-handling code, ask whether the failure is a
   normal branch of the job or a sign the environment broke
2. Prefer a returned value for expected failures: the caller should not
   need a `try`/`catch` to handle input validation
3. Reserve exceptions, `panic!`, or similar unwinding mechanisms for
   failures no local code path can sensibly recover from
4. State which guarantee a fallible function offers (basic, strong, or
   no-throw) especially for anything that mutates shared state partway
   through
