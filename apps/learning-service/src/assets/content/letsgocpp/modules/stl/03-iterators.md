# Iterators

Iterators are the glue between STL containers and algorithms. They provide a uniform interface to traverse any container.

## What is an Iterator?

An iterator is an object that points to an element in a container. You can dereference it (`*it`) to get the element, and advance it (`++it`) to move to the next.

```cpp
std::vector<int> v = {10, 20, 30, 40};

auto it = v.begin();  // points to first element
std::cout << *it;     // 10

++it;                 // move to next
std::cout << *it;     // 20

it += 2;              // jump forward 2
std::cout << *it;     // 40

// v.end() is one-past-the-last (sentinel, not valid to dereference)
```

---

## Iterator Categories

| Category          | Operations                 | Example                     |
| ----------------- | -------------------------- | --------------------------- |
| **Input**         | Read, single pass          | `std::istream_iterator`     |
| **Output**        | Write, single pass         | `std::ostream_iterator`     |
| **Forward**       | Read/write, multi-pass     | `std::forward_list`         |
| **Bidirectional** | Forward + `--`             | `std::list`, `std::map`     |
| **Random Access** | Bidirectional + `+=`, `[]` | `std::vector`, `std::array` |

---

## Standard Iterator Operations

```cpp
std::vector<int> v = {1, 2, 3, 4, 5};

// Range traversal
for (auto it = v.begin(); it != v.end(); ++it) {
    std::cout << *it << " ";
}

// Reverse iteration
for (auto it = v.rbegin(); it != v.rend(); ++it) {
    std::cout << *it << " ";
}
// 5 4 3 2 1

// Const iterators (read-only)
for (auto it = v.cbegin(); it != v.cend(); ++it) {
    // *it = 0;  // ERROR: const iterator
}
```

---

## Iterator Arithmetic (Random Access)

```cpp
std::vector<int> v = {10, 20, 30, 40, 50};

auto first = v.begin();
auto last = v.end();

// Distance
std::ptrdiff_t dist = last - first;  // 5

// Advance
auto third = first + 2;  // points to 30
std::cout << *third;

// std::advance (works with all iterator types)
auto it = v.begin();
std::advance(it, 3);  // move 3 steps
std::cout << *it;  // 40

// std::distance
auto d = std::distance(v.begin(), it);  // 3
```

---

## Insert Iterators

```cpp
#include <iterator>

std::vector<int> source = {1, 2, 3};
std::vector<int> dest;

// back_inserter — appends via push_back
std::copy(source.begin(), source.end(), std::back_inserter(dest));

// front_inserter — prepends via push_front (for deque/list)
std::deque<int> dq;
std::copy(source.begin(), source.end(), std::front_inserter(dq));
```

---

## Range-based for is Iterator Sugar

```cpp
// These are equivalent:
for (const auto& x : v) { ... }

for (auto it = v.begin(); it != v.end(); ++it) {
    const auto& x = *it;
    ...
}
```

---

## Custom Iterator (simplified)

```cpp
class Range {
    int start_, end_;
public:
    Range(int s, int e) : start_(s), end_(e) {}

    struct Iterator {
        int value_;
        int operator*() const { return value_; }
        Iterator& operator++() { ++value_; return *this; }
        bool operator!=(const Iterator& o) const { return value_ != o.value_; }
    };

    Iterator begin() { return {start_}; }
    Iterator end()   { return {end_}; }
};

for (int i : Range(1, 6)) {
    std::cout << i << " ";
}
// 1 2 3 4 5
```

---

## Key Takeaways

1. Iterators are a unified pointer-like interface for all containers
2. `begin()` points to the first element; `end()` is one-past-the-last
3. Use **range-based for** instead of manual iterators when possible
4. `std::advance` and `std::distance` work with all iterator types
5. **Insert iterators** (`back_inserter`) adapt algorithms to append to containers
6. C++20 **ranges** provide a more expressive, composable interface

---

## Next Steps

- **Templates** — write code that works with any type
- **Modern C++** — C++20 ranges for pipeline-style programming
