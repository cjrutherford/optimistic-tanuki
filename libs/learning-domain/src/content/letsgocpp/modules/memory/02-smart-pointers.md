# Smart Pointers

Smart pointers are wrapper classes that manage heap memory automatically, eliminating the need for manual `delete` calls. They are the modern C++ replacement for raw pointers with ownership.

## `std::unique_ptr` — Exclusive Ownership

A `unique_ptr` owns its resource exclusively. When the `unique_ptr` is destroyed, the resource is freed automatically.

```cpp
#include <memory>

{
    auto p = std::make_unique<int>(42);  // allocates int on heap
    std::cout << *p << "\n";             // 42
}   // p goes out of scope → int is deleted automatically

// Cannot copy, only move
auto p1 = std::make_unique<std::string>("hello");
// auto p2 = p1;            // ERROR: unique_ptr is not copyable
auto p2 = std::move(p1);    // OK: transfer ownership
// p1 is now nullptr
```

### With custom types

```cpp
struct Point { double x, y; };

auto point = std::make_unique<Point>(3.0, 4.0);
std::cout << point->x << "\n";  // 3

// Returns unique_ptr — caller owns the resource
std::unique_ptr<Point> makePoint(double x, double y) {
    return std::make_unique<Point>(x, y);
}
```

---

## `std::shared_ptr` — Shared Ownership

A `shared_ptr` uses **reference counting** — multiple pointers can own the same resource. The resource is freed when the last `shared_ptr` is destroyed.

```cpp
{
    auto s1 = std::make_shared<std::string>("hello");
    std::cout << s1.use_count() << "\n";  // 1

    {
        auto s2 = s1;   // copy — both own the string
        std::cout << s1.use_count() << "\n";  // 2
        std::cout << *s2 << "\n";  // hello
    }   // s2 destroyed, refcount goes to 1

    std::cout << s1.use_count() << "\n";  // 1
}   // s1 destroyed, refcount goes to 0 → string is deleted
```

### With polymorphism

```cpp
std::shared_ptr<Shape> shape = std::make_shared<Circle>(5.0);
// shape is freed when all shared_ptrs go out of scope
```

---

## `std::weak_ptr` — Non-Owning Reference

A `weak_ptr` observes a `shared_ptr` without participating in ownership. Used to break **circular references**.

```cpp
auto shared = std::make_shared<int>(42);
std::weak_ptr<int> weak = shared;

std::cout << weak.use_count() << "\n";  // 1 (weak doesn't count)
std::cout << weak.expired() << "\n";    // false

// Must lock() to use safely
if (auto locked = weak.lock()) {
    std::cout << *locked << "\n";  // 42
}

shared.reset();  // free the resource
std::cout << weak.expired() << "\n";  // true
```

---

## Choosing the Right Smart Pointer

| Question                               | Smart Pointer |
| -------------------------------------- | ------------- |
| Single owner, no sharing needed        | `unique_ptr`  |
| Multiple owners need the same resource | `shared_ptr`  |
| Observe but don't own                  | `weak_ptr`    |

**Default to `unique_ptr`.** Only use `shared_ptr` when you genuinely need shared ownership.

---

## `make_unique` vs `new`

Always prefer `make_unique` / `make_shared` over `new`:

```cpp
// Old style — avoid
std::unique_ptr<Foo> p(new Foo(1, 2, 3));

// Modern style — preferred
auto p = std::make_unique<Foo>(1, 2, 3);
```

**Why?**

- Exception-safe (no leak if constructor throws)
- Single allocation (for `make_shared` — object and refcount together)
- Cleaner syntax

---

## Key Takeaways

1. **`unique_ptr`** = single owner, zero overhead over raw pointer
2. **`shared_ptr`** = reference-counted, multiple owners
3. **`weak_ptr`** = non-owning observer, prevents circular refs
4. Always use `make_unique` / `make_shared` (not `new`)
5. Smart pointers automatically free memory when they go out of scope

---

## Next Steps

- **RAII** — the design principle behind smart pointers
- **Move Semantics** — efficient transfer of smart pointer ownership
