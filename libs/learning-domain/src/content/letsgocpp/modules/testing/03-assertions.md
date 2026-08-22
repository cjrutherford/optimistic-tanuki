# Assertions & Matchers

Catch2 provides a rich set of assertion macros and matchers to express what you expect in a clear, readable way.

## Core Assertions

```cpp
// REQUIRE — stop test on failure
REQUIRE(x == 5);
REQUIRE(x != 0);
REQUIRE(x > 0);
REQUIRE_FALSE(v.empty());

// CHECK — continue test on failure (find all failures at once)
CHECK(result.success);
CHECK(result.value == 42);
```

---

## Exception Assertions

```cpp
// Must throw any exception
REQUIRE_THROWS(badFunction());

// Must throw a specific exception type
REQUIRE_THROWS_AS(stack.pop(), std::underflow_error);
REQUIRE_THROWS_AS(vec.at(100), std::out_of_range);

// Must throw and message matches
REQUIRE_THROWS_WITH(
    throwingFunction(),
    Catch::Matchers::ContainsSubstring("error message")
);

// Must NOT throw
REQUIRE_NOTHROW(safeFunction());
```

---

## Floating Point Comparisons

Direct `==` comparison of floats is unreliable. Use `Catch::Approx`:

```cpp
double result = 1.0 / 3.0 * 3.0;
REQUIRE(result == Catch::Approx(1.0));               // within 1e-6
REQUIRE(result == Catch::Approx(1.0).epsilon(1e-9)); // custom tolerance
REQUIRE(result == Catch::Approx(1.0).margin(0.001)); // absolute margin
```

---

## String Matchers

```cpp
#include <catch_amalgamated.hpp>

using namespace Catch::Matchers;

std::string msg = "Hello, World!";

REQUIRE_THAT(msg, StartsWith("Hello"));
REQUIRE_THAT(msg, EndsWith("World!"));
REQUIRE_THAT(msg, ContainsSubstring("lo, W"));
REQUIRE_THAT(msg, Equals("Hello, World!"));
REQUIRE_THAT(msg, Matches("Hello.*!"));  // regex
```

---

## Container Matchers

```cpp
std::vector<int> v = {3, 1, 4, 1, 5, 9, 2, 6};

REQUIRE_THAT(v, Contains(5));                  // contains element
REQUIRE_THAT(v, Contains(std::vector<int>{1, 4})); // contains sub-range

std::vector<int> sorted = {1, 2, 3};
REQUIRE_THAT(sorted, UnorderedEquals(std::vector<int>{3, 1, 2}));

// Size matchers
REQUIRE_THAT(v, SizeIs(8));
```

---

## Combining Matchers

```cpp
using namespace Catch::Matchers;

REQUIRE_THAT(value, AnyOf(Equals(1), Equals(2), Equals(3)));
REQUIRE_THAT(value, AllOf(Gt(0), Lt(10)));
REQUIRE_THAT(msg, !StartsWith("Bye"));  // negation
```

---

## Custom Matchers

```cpp
struct IsEvenMatcher : Catch::Matchers::MatcherBase<int> {
    bool match(int const& x) const override { return x % 2 == 0; }
    std::string describe() const override { return "is even"; }
};

auto IsEven() { return IsEvenMatcher{}; }

REQUIRE_THAT(42, IsEven());
```

---

## INFO and CAPTURE — Debugging Context

```cpp
TEST_CASE("loop test") {
    for (int i = 0; i < 10; i++) {
        INFO("i = " << i);  // shown only on failure
        CAPTURE(i);          // shortcut: shows "i = 5" on failure
        REQUIRE(someFunction(i) > 0);
    }
}
```

---

## Test Generator — Parameterized Tests

```cpp
TEST_CASE("fizzbuzz generator", "[fizzbuzz]") {
    auto n = GENERATE(3, 6, 9, 12);
    REQUIRE(fizzBuzz(n) == "Fizz");
}

TEST_CASE("range generator") {
    auto n = GENERATE(range(1, 11));  // 1 through 10
    INFO("n = " << n);
    CHECK(n > 0);
    CHECK(n <= 10);
}
```

---

## Key Takeaways

1. `REQUIRE` stops on first failure; `CHECK` collects all failures
2. Use `Catch::Approx` for floating-point comparisons
3. **Matchers** (`REQUIRE_THAT`) provide expressive, descriptive assertions
4. `INFO` / `CAPTURE` add context shown only on failure
5. `GENERATE` creates parameterized tests without code duplication
6. Exception assertions (`REQUIRE_THROWS_AS`) are first-class citizens

---

## Summary: C++ Testing Best Practices

1. **Name test cases descriptively** — they document expected behavior
2. **One concept per test case** — focused, easy to diagnose
3. **Use SECTION** to organize related scenarios with shared setup
4. **Test edge cases** — empty inputs, negative values, boundaries
5. **Test exceptions** — verify your code throws when it should
6. **Use matchers** for readable, self-documenting assertions
