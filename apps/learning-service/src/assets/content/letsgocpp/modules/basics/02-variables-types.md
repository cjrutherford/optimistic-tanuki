# Variables & Types

C++ is a **statically typed** language — every variable has a type determined at compile time. This is very different from JavaScript/Python where types are dynamic.

## Fundamental Types

```cpp
#include <iostream>
#include <string>

int main() {
    // Integer types
    int age = 25;                    // 32-bit signed integer
    long long bigNum = 9000000000LL; // 64-bit signed integer
    unsigned int count = 0;          // non-negative integer

    // Floating point
    float pi_f = 3.14f;              // 32-bit float
    double pi = 3.14159265358979;    // 64-bit float (preferred)

    // Character and string
    char letter = 'A';               // single character
    std::string name = "Alice";      // dynamic string

    // Boolean
    bool isReady = true;

    std::cout << age << " " << name << " " << isReady << "\n";
    return 0;
}
```

---

## Type Sizes

| Type        | Size    | Range           |
| ----------- | ------- | --------------- |
| `bool`      | 1 byte  | true/false      |
| `char`      | 1 byte  | -128 to 127     |
| `int`       | 4 bytes | ±2.1 billion    |
| `long long` | 8 bytes | ±9.2 × 10¹⁸     |
| `float`     | 4 bytes | ~7 sig. digits  |
| `double`    | 8 bytes | ~15 sig. digits |

Use `sizeof(type)` to get the size on your platform:

```cpp
std::cout << sizeof(int) << "\n";    // typically 4
std::cout << sizeof(double) << "\n"; // typically 8
```

---

## Variable Declaration & Initialization

C++ offers multiple initialization syntaxes:

```cpp
// C-style initialization
int x = 5;

// Direct initialization
int y(10);

// Brace (uniform) initialization — preferred in modern C++
int z{15};
double d{3.14};
std::string s{"hello"};

// auto — compiler infers the type
auto count = 42;        // int
auto price = 9.99;      // double
auto greeting = std::string{"Hi"};
```

**Brace initialization prevents narrowing conversions:**

```cpp
int x = 3.7;   // OK, truncates to 3 (silent bug!)
int y{3.7};    // ERROR: narrowing conversion, caught at compile time
```

---

## Constants

```cpp
const double PI = 3.14159265358979;  // runtime constant
constexpr int MAX_SIZE = 100;        // compile-time constant (preferred)

// PI = 4.0;  // Error: assignment of read-only variable
```

`constexpr` is stronger than `const` — it guarantees the value is known at compile time and can be used in contexts that require compile-time constants (like array sizes).

---

## Type Conversion

### Implicit (Automatic)

```cpp
int i = 42;
double d = i;   // int → double, safe
float f = d;    // double → float, may lose precision (compiler warning)
```

### Explicit (Casting)

```cpp
double d = 3.99;
int i = static_cast<int>(d);   // 3 (truncates, not rounds)
```

**Prefer `static_cast<>` over C-style casts:**

```cpp
int x = (int)3.14;           // C-style cast — avoid
int y = static_cast<int>(3.14); // C++ cast — preferred
```

---

## String Operations

```cpp
#include <string>
#include <iostream>

int main() {
    std::string first = "Hello";
    std::string second = "World";

    // Concatenation
    std::string greeting = first + ", " + second + "!";
    std::cout << greeting << "\n"; // Hello, World!

    // Length
    std::cout << greeting.length() << "\n"; // 13

    // Substring
    std::cout << greeting.substr(0, 5) << "\n"; // Hello

    // Find
    size_t pos = greeting.find("World");
    std::cout << pos << "\n"; // 7

    // Conversion
    int num = std::stoi("42");       // string to int
    std::string s = std::to_string(42); // int to string

    return 0;
}
```

---

## Key Takeaways

1. C++ types are **static** — declared at compile time
2. Prefer **brace initialization** `{}` to catch type errors early
3. Use `constexpr` for compile-time constants
4. Use `static_cast<>` for explicit type conversions
5. `std::string` is the modern way to handle text
6. `auto` lets the compiler deduce types for cleaner code

---

## Next Steps

- **Functions** — Organize code into reusable building blocks
- **Control Flow** — Make decisions and loop with if/for/while
