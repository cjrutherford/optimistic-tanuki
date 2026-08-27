# Stack vs Heap

Understanding where your data lives in memory is crucial for writing correct, performant C++ programs.

## The Stack

The **stack** is a contiguous block of memory managed automatically by the CPU. Variables allocated on the stack are cleaned up when they go out of scope.

```cpp
void example() {
    int x = 10;          // stack-allocated
    double arr[100];     // stack-allocated array
    std::string name = "Alice"; // the string object is on stack,
                                // but its internal buffer may be on heap

}   // x, arr, name all automatically destroyed here
```

**Characteristics:**

- Very fast allocation/deallocation (just move stack pointer)
- Limited size (typically 1–8 MB)
- Automatic lifetime management
- Cannot use for objects whose size is unknown at compile time

---

## The Heap

The **heap** is a large pool of memory you explicitly manage with `new` and `delete`.

```cpp
int* p = new int(42);           // allocate one int
int* arr = new int[1000];       // allocate array

// Must free manually!
delete p;                        // free single object
delete[] arr;                    // free array (note [])

p = nullptr;                     // good practice
```

**Characteristics:**

- Large (limited by available system memory)
- Slower allocation (OS must find free block)
- Manual lifetime management — **you** must free it
- Essential for dynamic sizes and long-lived objects

---

## Stack vs Heap Summary

|                            | Stack             | Heap                |
| -------------------------- | ----------------- | ------------------- |
| Size                       | Small (~MB)       | Large (~GB)         |
| Speed                      | Fast              | Slower              |
| Lifetime                   | Automatic (scope) | Manual (new/delete) |
| Fragmentation              | None              | Possible            |
| Size known at compile time | Required          | Not required        |

---

## Common Memory Bugs

### Memory Leak

```cpp
void leak() {
    int* p = new int(42);
    // forgot to delete p!
}  // memory lost forever — leak
```

### Dangling Pointer

```cpp
int* p = new int(42);
delete p;
*p = 10;   // UNDEFINED BEHAVIOR — p points to freed memory
```

### Double Delete

```cpp
int* p = new int(42);
delete p;
delete p;  // UNDEFINED BEHAVIOR
```

### Buffer Overflow

```cpp
int* arr = new int[5];
arr[10] = 99;  // writes beyond allocated memory — UNDEFINED BEHAVIOR
```

---

## Don't Allocate At All

C++ has no escape analysis in the sense languages like Go and Java have it.
There, the compiler owns the allocator and can quietly move a heap object to
the stack. In C++ `operator new` is replaceable — a program may define its
own, with observable behaviour like logging or counting — so the compiler
cannot generally decide on your behalf that an allocation should not happen.
The standard does permit allocations to be omitted or merged in narrow cases,
but it is not a guarantee, and no implementation reliably turns a
`make_unique` into a stack object:

```cpp
// This heap-allocates. Assume it does, because you cannot verify otherwise.
std::unique_ptr<int> p = std::make_unique<int>(42);
```

Which is the useful lesson: in C++ you do not hope the optimiser removes an
allocation, you decline to write one. A value that lives and dies inside one
scope should be a local.

```cpp
int value = 42;             // no allocation
std::array<int, 64> buf{};  // no allocation, size known at compile time
std::vector<int> v;         // one allocation, and only when it grows
v.reserve(1000);            // one allocation instead of a dozen
```

Reach for the heap when you need a lifetime that outlives the scope, or a size
you only learn at runtime and cannot bound. Otherwise the stack is both faster
and impossible to leak.

---

## Valgrind — Detecting Memory Issues

```bash
# Check for memory leaks and invalid accesses
valgrind --leak-check=full ./your_program
```

---

## Key Takeaways

1. **Stack** = fast, automatic, limited size
2. **Heap** = flexible, manual, larger
3. Every `new` must have a matching `delete` (or use smart pointers!)
4. Use `delete[]` for arrays allocated with `new[]`
5. Set pointers to `nullptr` after deletion
6. Prefer **smart pointers** to avoid these bugs entirely

---

## Next Steps

- **Smart Pointers** — the modern, safe alternative to raw new/delete
- **RAII** — the design pattern that makes resource management automatic
