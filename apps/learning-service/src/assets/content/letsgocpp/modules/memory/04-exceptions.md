# Exceptions and Exception Safety

An exception is how a function reports that it could not do its job, when
returning a value will not work: constructors have no return value, and
operators like `[]` have one already spoken for.

This lesson sits after RAII on purpose. The two are the same subject seen from
opposite ends. Exceptions are why C++ needs RAII, and RAII is what makes
exceptions survivable.

---

## Throwing and Catching

```cpp
#include <stdexcept>
#include <iostream>

double divide(double a, double b) {
    if (b == 0) {
        throw std::invalid_argument("division by zero");
    }
    return a / b;
}

int main() {
    try {
        std::cout << divide(10, 2) << "\n";
        std::cout << divide(1, 0) << "\n";  // throws
        std::cout << "never reached\n";
    } catch (const std::invalid_argument& e) {
        std::cout << "caught: " << e.what() << "\n";
    }
}
```

```text
5
caught: division by zero
```

Catch by `const` reference. Catching by value slices a derived exception down
to the base type you named, losing everything specific about it, which is the
same slicing problem the polymorphism lesson described.

---

## The Standard Hierarchy

Everything in `<stdexcept>` derives from `std::exception`, which supplies
`what()`.

```text
std::exception
├── std::logic_error        the program is wrong
│   ├── std::invalid_argument
│   ├── std::out_of_range
│   └── std::domain_error
└── std::runtime_error      the world is wrong
    ├── std::overflow_error
    └── std::range_error
```

Order your handlers most-derived first. They are tried in order, so a base
class handler placed first catches everything below it and the later ones are
dead code:

```cpp
try {
    risky();
} catch (const std::out_of_range& e) {   // most specific
    // ...
} catch (const std::logic_error& e) {    // its base
    // ...
} catch (const std::exception& e) {      // the root
    // ...
} catch (...) {                          // anything at all, even non-exceptions
    // ...
}
```

Deriving your own from `std::runtime_error` costs one line and gives you
`what()` for free:

```cpp
class ConfigError : public std::runtime_error {
public:
    explicit ConfigError(const std::string& what)
        : std::runtime_error(what) {}
};
```

---

## Stack Unwinding, and Why RAII Matters

When an exception is thrown, C++ walks back up the call stack looking for a
handler, destroying every local object it passes on the way. That is called
unwinding, and it runs destructors.

Destructors only. It does not free anything you allocated by hand:

```cpp
void leaky() {
    int* buffer = new int[1000];
    mightThrow();          // if this throws, the delete below never runs
    delete[] buffer;       // and the memory is gone for good
}
```

There is no `finally` in C++ to rescue this, and that is deliberate: the
destructor already is the `finally`, and it is written once in the class rather
than at every call site.

```cpp
void safe() {
    std::vector<int> buffer(1000);   // owns its memory
    mightThrow();                    // if this throws, ~vector still runs
}                                    // and so does nothing else need to
```

Every RAII type you have met behaves this way. `std::unique_ptr`,
`std::lock_guard` and `std::vector` all release in their destructors, so they
release during unwinding too. A `lock_guard` unlocks its mutex even when the
function is leaving because of an exception, which is exactly why you were told
to prefer it over calling `lock()` and `unlock()` yourself.

---

## The Guarantees

When you write a function that can throw, say what state it leaves behind. The
three levels, weakest to strongest:

**Basic**: nothing leaks and every object is still valid, though values may
have changed. This is the minimum, and RAII gives it to you almost for free.

**Strong**: the operation either fully succeeds or changes nothing at all. A
failed call leaves the object exactly as it was. `std::vector::push_back`
promises this.

**No-throw**: it cannot throw. Destructors, `swap` and move operations should
aim for this, because the strong guarantee is usually built out of them.

The standard way to get the strong guarantee is copy-and-swap: do the work
somewhere else, and only commit with an operation that cannot fail.

```cpp
void Buffer::append(const std::vector<int>& more) {
    std::vector<int> candidate = data_;                       // may throw
    candidate.insert(candidate.end(), more.begin(), more.end()); // may throw
    data_.swap(candidate);   // cannot throw, so this is the commit point
}
```

If either line throws, `data_` was never touched.

---

## Destructors Must Not Throw

A destructor that throws while another exception is already unwinding gives you
two live exceptions and the program calls `std::terminate`. Since C++11
destructors are implicitly `noexcept`, so a throw from one terminates by
default.

```cpp
~FileHandle() {
    try {
        close();          // if this can fail, deal with it here
    } catch (...) {
        // Log it. Do not rethrow.
    }
}
```

If a failure genuinely needs reporting, give the class an explicit `close()`
that callers can invoke and check, and let the destructor handle only the case
where they did not.

---

## When Not To Use Them

Exceptions are for the exceptional. A file that is missing when you expected it
is exceptional; a user typing a letter into a number field is not, it is the
normal case for input validation.

For the ordinary failure, return it. Since C++17 `std::optional<T>` says "a
value or nothing", and C++23 adds `std::expected<T, E>` for "a value or a
reason". Both make the failure visible in the signature, which an exception
does not.

Some codebases disable exceptions entirely, in embedded work or where the
timing cost of unwinding is unacceptable. In those, the standard library
throwing functions are off the table and `std::vector::at` is unusable; you
check bounds yourself and use `operator[]`.

---

## Best Practices

1. Throw by value, catch by `const` reference
2. Derive your exceptions from `std::runtime_error` or `std::logic_error`
3. Order handlers most-derived first, or the later ones never run
4. Never write manual cleanup after something that can throw; give it to a destructor
5. Say which guarantee each function offers, and use copy-and-swap for the strong one
6. Keep destructors, swap and move operations no-throw
7. Use `optional` or `expected` for failures that are part of normal operation
