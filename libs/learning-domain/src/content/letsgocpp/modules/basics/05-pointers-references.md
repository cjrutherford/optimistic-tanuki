# Pointers & References

Pointers and references are foundational to C++. They let you work directly with memory, enable efficient data passing, and support polymorphism.

## References

A reference is an **alias** — another name for an existing variable.

```cpp
int x = 42;
int& ref = x;   // ref is an alias for x

ref = 100;      // modifies x through the reference
std::cout << x; // 100

// References must be initialized at declaration
int& bad;  // ERROR: reference must be initialized
```

**Key properties:**

- Must be bound at declaration
- Cannot be rebound to another variable
- No null references (unlike pointers)

### Use in functions

```cpp
void doubleIt(int& n) {
    n *= 2;
}

int value = 5;
doubleIt(value);   // value is now 10
```

---

## Pointers

A pointer holds the **memory address** of another variable.

```cpp
int x = 42;
int* ptr = &x;    // ptr holds the address of x

// Dereference — access the value at the address
std::cout << *ptr;   // 42

// Modify through pointer
*ptr = 100;
std::cout << x;      // 100

// Null pointer — points to nothing
int* nullPtr = nullptr;  // use nullptr, not NULL or 0
```

### Pointer arithmetic

```cpp
int arr[] = {10, 20, 30, 40};
int* p = arr;       // points to arr[0]

std::cout << *p;    // 10
p++;                // move to next element
std::cout << *p;    // 20
std::cout << *(p + 1); // 30
```

---

## Pointer vs Reference

|                | Pointer      | Reference        |
| -------------- | ------------ | ---------------- |
| Can be null    | ✅ `nullptr` | ❌               |
| Can be rebound | ✅           | ❌               |
| Requires deref | ✅ `*ptr`    | ❌ (transparent) |
| Arithmetic     | ✅           | ❌               |

**Rule of thumb:** Prefer references when you don't need null or rebinding.

---

## const Pointers

```cpp
int x = 10, y = 20;

// Pointer to const — can't modify the value
const int* p1 = &x;
// *p1 = 5;  // ERROR
p1 = &y;     // OK — can point elsewhere

// Const pointer — can't point elsewhere
int* const p2 = &x;
*p2 = 5;     // OK — can modify value
// p2 = &y;  // ERROR

// Const pointer to const — neither
const int* const p3 = &x;
```

---

## Dynamic Memory

```cpp
// Allocate on heap
int* p = new int(42);
std::cout << *p;   // 42

// Must free manually!
delete p;
p = nullptr;  // good practice

// Arrays
int* arr = new int[10];
// ... use arr ...
delete[] arr;  // NOTE: delete[] for arrays
```

> **Warning:** Raw `new/delete` leads to memory leaks and bugs. Prefer smart pointers (`unique_ptr`, `shared_ptr`) in modern C++.

---

## Pointer to Functions

```cpp
int add(int a, int b) { return a + b; }

int (*funcPtr)(int, int) = add;
std::cout << funcPtr(3, 4);  // 7

// Much cleaner with auto or using:
auto f = add;
f(3, 4);  // 7
```

---

## Key Takeaways

1. **References** are aliases — prefer them when you don't need null/rebinding
2. **Pointers** hold addresses, use `*` to dereference and `&` to take address
3. Use `nullptr` for null pointers (not `NULL` or `0`)
4. `const int*` = pointer to const value; `int* const` = const pointer
5. Prefer **smart pointers** over raw `new/delete` for heap memory

---

## Next Steps

- **Classes & Objects** — encapsulate data and behavior
- **Smart Pointers** — safe memory management without manual delete
