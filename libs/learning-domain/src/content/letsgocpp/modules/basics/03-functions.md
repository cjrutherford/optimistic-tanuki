# Functions

Functions are the building blocks of C++ programs. They let you name, reuse, and compose logic.

## Basic Function Syntax

```cpp
return_type function_name(parameter_type parameter_name, ...) {
    // body
    return value; // if return_type is not void
}
```

### Example

```cpp
#include <iostream>

int add(int a, int b) {
    return a + b;
}

void greet(const std::string& name) {
    std::cout << "Hello, " << name << "!\n";
}

int main() {
    int sum = add(3, 4);     // 7
    greet("Alice");          // Hello, Alice!
    return 0;
}
```

---

## Function Overloading

C++ allows multiple functions with the **same name** but different parameter types:

```cpp
int multiply(int a, int b) { return a * b; }
double multiply(double a, double b) { return a * b; }
std::string multiply(const std::string& s, int n) {
    std::string result;
    for (int i = 0; i < n; i++) result += s;
    return result;
}

multiply(2, 3);            // calls int version → 6
multiply(2.5, 4.0);        // calls double version → 10.0
multiply("abc", 3);        // calls string version → "abcabcabc"
```

---

## Default Parameters

```cpp
void printLine(const std::string& msg, char sep = '-', int width = 40) {
    for (int i = 0; i < width; i++) std::cout << sep;
    std::cout << "\n" << msg << "\n";
    for (int i = 0; i < width; i++) std::cout << sep;
    std::cout << "\n";
}

printLine("Title");           // uses defaults: '-', 40
printLine("Title", '=');      // uses '=', 40
printLine("Title", '*', 20);  // uses '*', 20
```

**Rule:** Default parameters must be at the **end** of the parameter list.

---

## Pass by Value vs Reference vs Const Reference

```cpp
// Pass by VALUE — function gets a copy
void incrementCopy(int x) { x++; }  // original unchanged

// Pass by REFERENCE — function modifies the original
void incrementRef(int& x) { x++; }  // original IS changed

// Pass by CONST REFERENCE — read-only, no copy overhead
double sumVector(const std::vector<double>& v) {
    double total = 0;
    for (double x : v) total += x;
    return total;
}
```

**Best practices:**

- Small types (int, double, char): pass by value
- Large objects (string, vector, class): pass by `const&`
- Need to modify caller's variable: pass by `&`

---

## Return Types

### Returning Multiple Values

C++ functions return one value. To return multiple, use:

**Pair:**

```cpp
#include <utility>
std::pair<int, int> minMax(const std::vector<int>& v) {
    int mn = v[0], mx = v[0];
    for (int x : v) {
        if (x < mn) mn = x;
        if (x > mx) mx = x;
    }
    return {mn, mx};
}

auto [min, max] = minMax({3, 1, 4, 1, 5, 9}); // C++17 structured binding
```

**Output parameters (older style):**

```cpp
void divide(int a, int b, int& quotient, int& remainder) {
    quotient = a / b;
    remainder = a % b;
}
```

---

## Inline Functions

For small, frequently-called functions, `inline` suggests the compiler substitute the call with the function body:

```cpp
inline int square(int x) { return x * x; }
```

Modern compilers usually inline automatically, so explicit `inline` is mostly a hint.

---

## Lambda Functions (C++11)

Lambdas are anonymous functions defined inline:

```cpp
auto add = [](int a, int b) { return a + b; };
std::cout << add(3, 4) << "\n";  // 7

// Capturing variables from surrounding scope
int multiplier = 3;
auto triple = [multiplier](int x) { return x * multiplier; };
std::cout << triple(5) << "\n";  // 15
```

---

## Recursion

```cpp
long long fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}
```

---

## Key Takeaways

1. Functions take parameters and return values
2. **Overloading** — same name, different parameter types
3. **Default parameters** — allow optional arguments
4. Pass large objects by `const&` to avoid copies
5. Lambdas are anonymous functions for inline use
6. C++17 **structured bindings** `auto [a, b] = ...` for unpacking pairs

---

## Next Steps

- **Control Flow** — if/else, loops, and switch
- **Pointers & References** — deep dive into memory addressing
