# Catch2 Basics

**Catch2** is the most popular C++ testing framework. It's lightweight, expressive, and uses a natural English-style syntax that makes tests easy to read and write.

## Why Catch2?

- **Single header** — easy to include in any project
- **Natural language** syntax — `REQUIRE(result == expected)`
- **Automatic test discovery** — no manual registration needed
- **Rich output** — shows exact values on failure
- **Test cases and sections** — organize complex tests cleanly

---

## Your First Catch2 Test

```cpp
#include "catch_amalgamated.hpp"

int add(int a, int b) { return a + b; }

TEST_CASE("add function works correctly", "[math]") {
    REQUIRE(add(2, 3) == 5);
    REQUIRE(add(-1, 1) == 0);
    REQUIRE(add(0, 0) == 0);
}
```

Compile and run:

```bash
g++ -std=c++17 -I./catch2 test.cpp catch2/catch_amalgamated.cpp -o test
./test
```

Output on success:

```
===============================================================================
All tests passed (3 assertions in 1 test case)
```

Output on failure:

```
test.cpp:6: FAILED:
  REQUIRE( add(2, 3) == 10 )
with expansion:
  5 == 10
```

---

## Assertions

### `REQUIRE` vs `CHECK`

```cpp
TEST_CASE("assertions demo") {
    REQUIRE(1 + 1 == 2);   // STOPS test case on failure
    CHECK(2 + 2 == 4);     // CONTINUES test case on failure

    // Use REQUIRE for pre-conditions
    // Use CHECK to find all failures in one run
}
```

---

## Assertion Macros

```cpp
REQUIRE(expression);              // must be true
REQUIRE_FALSE(expression);        // must be false

CHECK(expression);                // non-fatal true
CHECK_FALSE(expression);          // non-fatal false

REQUIRE_THROWS(expression);              // must throw any exception
REQUIRE_THROWS_AS(expression, Type);     // must throw specific type
REQUIRE_NOTHROW(expression);             // must not throw

CHECK_THROWS_AS(expr, std::runtime_error);
```

---

## Tags

Tags categorize test cases for selective running:

```cpp
TEST_CASE("Vector operations", "[stl][container]") { ... }
TEST_CASE("Sort algorithm", "[stl][algorithm]") { ... }
TEST_CASE("File I/O", "[io]") { ... }
```

Run only tagged tests:

```bash
./test "[stl]"         # run all STL tests
./test "[algorithm]"   # run only algorithm tests
./test "~[io]"         # run everything EXCEPT io tests
```

---

## Test Case Naming

Name test cases descriptively — they appear in output:

```cpp
// ✅ Good names
TEST_CASE("factorial returns 1 for n=0 and n=1", "[math]")
TEST_CASE("sort produces ascending order", "[sort]")
TEST_CASE("map::find returns end() when key not found", "[map]")

// ❌ Bad names
TEST_CASE("test1")
TEST_CASE("function test")
```

---

## Running Tests

```bash
./test                    # run all tests
./test -v                 # verbose output
./test "[tag]"            # run tagged tests
./test "test case name"   # run by name (substring match)
./test --list-tests       # list all test names
./test --reporter compact # compact output format
```

---

## Key Takeaways

1. `TEST_CASE("description", "[tags]")` — defines a test
2. `REQUIRE(expr)` — stops on failure; `CHECK(expr)` — continues
3. `REQUIRE_THROWS_AS(expr, Type)` — verifies exceptions
4. Tags enable selective test execution
5. Catch2 auto-generates `main()` — no manual registration needed

---

## Next Steps

- **Test Cases & Sections** — organize complex tests with `SECTION`
- **Assertions & Matchers** — advanced matching for collections, strings, and more
