# auto & Lambdas

C++11 introduced two features that make C++ code dramatically cleaner: `auto` type deduction and **lambda expressions**.

## `auto` Type Deduction

`auto` lets the compiler infer the type from the initializer:

```cpp
auto x = 42;           // int
auto d = 3.14;         // double
auto s = std::string{"hello"};  // std::string
auto v = std::vector<int>{1, 2, 3};  // std::vector<int>

// Especially useful with complex iterator types
auto it = v.begin();   // std::vector<int>::iterator
auto& ref = v[0];      // int&

// Without auto (verbose):
std::vector<std::pair<std::string, int>>::iterator it2 = myMap.begin();
// With auto:
auto it3 = myMap.begin();  // much cleaner
```

### `auto` in range-based for

```cpp
for (auto& x : vec) { ... }        // reference — modifiable
for (const auto& x : vec) { ... }  // const ref — read-only, efficient
for (auto x : vec) { ... }         // copy — for small types
```

---

## Lambda Expressions

A lambda is an **anonymous inline function** you can pass around like a value.

### Basic syntax

```cpp
[capture](parameters) -> return_type { body }
```

```cpp
auto square = [](int x) { return x * x; };
std::cout << square(5);  // 25

auto add = [](int a, int b) -> int { return a + b; };
std::cout << add(3, 4);  // 7
```

---

## Capture Clauses

Lambdas can capture variables from their enclosing scope:

```cpp
int factor = 3;

// Capture by value (copy)
auto triple = [factor](int x) { return x * factor; };

// Capture by reference
auto increment = [&factor]() { factor++; };

// Capture all by value
auto f1 = [=](int x) { return x * factor; };

// Capture all by reference
auto f2 = [&](int x) { factor += x; };

// Mixed
auto f3 = [factor, &counter](int x) { counter++; return x * factor; };
```

---

## Lambdas with Standard Algorithms

```cpp
std::vector<int> v = {5, 2, 8, 1, 9, 3, 7};

// Sort with lambda comparator
std::sort(v.begin(), v.end(), [](int a, int b){ return a > b; }); // descending

// Filter
std::vector<int> evens;
std::copy_if(v.begin(), v.end(), std::back_inserter(evens),
             [](int x){ return x % 2 == 0; });

// Transform
std::vector<std::string> strs;
std::transform(v.begin(), v.end(), std::back_inserter(strs),
               [](int x){ return std::to_string(x); });

// Reduce
int sum = std::accumulate(v.begin(), v.end(), 0,
                          [](int acc, int x){ return acc + x; });
```

---

## Generic Lambdas (C++14)

```cpp
auto add = [](auto a, auto b) { return a + b; };

add(3, 4);        // int + int = int
add(3.14, 2.71);  // double + double = double
add(1, 2.5);      // int + double = double
```

---

## std::function — Storing Lambdas

```cpp
#include <functional>

std::function<int(int, int)> op;

op = [](int a, int b) { return a + b; };
std::cout << op(3, 4);  // 7

op = [](int a, int b) { return a * b; };
std::cout << op(3, 4);  // 12
```

---

## Key Takeaways

1. `auto` reduces verbosity and automatically stays up-to-date with type changes
2. Lambdas are anonymous functions — perfect for one-off predicates and callbacks
3. **Capture by value `[=]`** copies variables; **capture by reference `[&]`** references them
4. Generic lambdas (`auto` parameters) work like function templates (C++14)
5. Use `std::function<R(Args...)>` to store lambdas in variables or pass as parameters

---

## Next Steps

- **Move Semantics** — transfer resources without expensive copying
- **Concurrency** — use lambdas with std::thread
