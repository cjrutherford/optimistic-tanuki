# Function Templates

Templates allow you to write **generic** code that works with any type. They are the foundation of the STL and are resolved entirely at **compile time**.

## Basic Function Template

```cpp
// Without templates — repeated code
int addInts(int a, int b) { return a + b; }
double addDoubles(double a, double b) { return a + b; }

// With a function template — one function for all types
template<typename T>
T add(T a, T b) {
    return a + b;
}

add(3, 4);         // T = int    → 7
add(3.14, 2.71);   // T = double → 5.85
add(1L, 2L);       // T = long   → 3
```

---

## Template Type Deduction

The compiler deduces `T` from the arguments:

```cpp
template<typename T>
T square(T x) { return x * x; }

square(5);      // deduced: T = int
square(3.14);   // deduced: T = double
square<long>(5); // explicit: T = long
```

---

## Multiple Template Parameters

```cpp
template<typename T, typename U>
auto multiply(T a, U b) -> decltype(a * b) {
    return a * b;
}

multiply(3, 2.5);    // int * double = double
multiply(2, 10LL);   // int * long long = long long
```

In C++14+, use `auto` return type:

```cpp
template<typename T, typename U>
auto multiply(T a, U b) {
    return a * b;  // return type deduced
}
```

---

## Non-Type Template Parameters

Templates can also take **values** (not just types):

```cpp
template<int N>
int multiplyByN(int x) {
    return x * N;
}

multiplyByN<3>(5);   // 15
multiplyByN<10>(5);  // 50

// Fixed-size array using non-type parameter
template<typename T, size_t N>
T sumArray(const T (&arr)[N]) {
    T total{};
    for (size_t i = 0; i < N; i++) total += arr[i];
    return total;
}

int nums[] = {1, 2, 3, 4, 5};
sumArray(nums);  // 15, N automatically deduced as 5
```

---

## Concepts (C++20)

Constrain template parameters with **concepts**:

```cpp
#include <concepts>

template<typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

template<Numeric T>
T safeDivide(T a, T b) {
    if (b == T{0}) throw std::invalid_argument("divide by zero");
    return a / b;
}
```

---

## Common Standard Library Function Templates

```cpp
std::min(3, 5);          // template — works for any comparable type
std::max(3.14, 2.71);
std::swap(a, b);
std::move(obj);
std::forward<T>(arg);
```

---

## Key Takeaways

1. Templates are **resolved at compile time** — no runtime overhead
2. Type parameters with `typename T` or `class T`
3. Non-type parameters can be integral values, pointers, etc.
4. The compiler generates specialized code for each unique template instantiation
5. Use **concepts** (C++20) to constrain what types are accepted
6. Template errors can be verbose — work from the first error message

---

## Next Steps

- **Class Templates** — generic data structures
- **Template Specialization** — customize behavior for specific types
