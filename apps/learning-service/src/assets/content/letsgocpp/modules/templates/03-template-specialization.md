# Template Specialization

Template specialization lets you provide a **custom implementation** for a specific type while keeping the generic version for everything else.

## Full Specialization

```cpp
// Generic template
template<typename T>
class TypeName {
public:
    static std::string get() { return "unknown"; }
};

// Full specialization for int
template<>
class TypeName<int> {
public:
    static std::string get() { return "int"; }
};

// Full specialization for std::string
template<>
class TypeName<std::string> {
public:
    static std::string get() { return "string"; }
};

TypeName<int>::get();        // "int"
TypeName<std::string>::get(); // "string"
TypeName<double>::get();      // "unknown"
```

---

## Function Template Specialization

```cpp
// Generic
template<typename T>
void print(T value) {
    std::cout << value << "\n";
}

// Specialization for bool — print true/false instead of 1/0
template<>
void print<bool>(bool value) {
    std::cout << (value ? "true" : "false") << "\n";
}

print(42);    // 42
print(3.14);  // 3.14
print(true);  // true  (uses specialization)
```

---

## Partial Specialization (Class Templates Only)

Partial specialization fixes some template parameters while leaving others generic:

```cpp
// Generic pair wrapper
template<typename T, typename U>
class Pair {
public:
    Pair(T first, U second) : first_(first), second_(second) {}
    void print() { std::cout << first_ << ", " << second_ << "\n"; }
private:
    T first_; U second_;
};

// Partial specialization: when both types are the same
template<typename T>
class Pair<T, T> {
public:
    Pair(T first, T second) : first_(first), second_(second) {}
    T sum() { return first_ + second_; }  // only makes sense for same types
    void print() { std::cout << "(" << first_ << ", " << second_ << ")\n"; }
private:
    T first_; T second_;
};

// Partial specialization: pointer types
template<typename T>
class Pair<T*, T*> {
public:
    // Special handling for pointer pairs
};
```

---

## `std::is_same` and `if constexpr`

Modern C++ offers cleaner alternatives to specialization:

```cpp
#include <type_traits>

template<typename T>
void describe(T value) {
    if constexpr (std::is_integral_v<T>) {
        std::cout << "integer: " << value << "\n";
    } else if constexpr (std::is_floating_point_v<T>) {
        std::cout << "float: " << value << "\n";
    } else {
        std::cout << "other: " << value << "\n";
    }
}

describe(42);    // integer: 42
describe(3.14);  // float: 3.14
describe("hi");  // other: hi
```

---

## Type Traits

The `<type_traits>` library provides compile-time type information:

```cpp
std::is_integral_v<int>          // true
std::is_floating_point_v<double> // true
std::is_pointer_v<int*>          // true
std::is_const_v<const int>       // true
std::is_same_v<int, long>        // false (platform-dependent)

// Transform types
std::remove_const_t<const int>   // int
std::remove_pointer_t<int*>      // int
std::add_pointer_t<int>          // int*
```

---

## Key Takeaways

1. **Full specialization** provides a custom implementation for one specific type
2. **Partial specialization** works only for class templates, not function templates
3. Use **`if constexpr`** (C++17) as a cleaner alternative to specialization
4. `<type_traits>` provides compile-time type inspection and transformation
5. Prefer `if constexpr` + concepts (C++20) over complex specializations

---

## Next Steps

- **auto & Lambdas** — type deduction and anonymous functions
- **Move Semantics** — efficient value transfer without copying
