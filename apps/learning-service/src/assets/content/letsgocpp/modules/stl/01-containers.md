# STL Containers

The C++ Standard Template Library provides a rich set of container types that handle memory management automatically.

## `std::vector` — Dynamic Array

The most commonly used container. Like a resizable array.

```cpp
#include <vector>

std::vector<int> v = {1, 2, 3, 4, 5};

// Add elements
v.push_back(6);       // O(1) amortized
v.emplace_back(7);    // construct in-place, slightly more efficient

// Access
v[0];                 // 1 — no bounds check
v.at(0);              // 1 — bounds-checked, throws std::out_of_range

// Size/Capacity
v.size();             // 7
v.capacity();         // at least 7 (often more, due to doubling strategy)
v.empty();            // false

// Remove
v.pop_back();         // remove last element
v.erase(v.begin() + 2);  // remove element at index 2

// Iteration
for (const auto& x : v) std::cout << x << " ";
```

---

## `std::map` — Sorted Key-Value

Ordered associative container. Keys are sorted. O(log n) operations.

```cpp
#include <map>

std::map<std::string, int> scores;
scores["Alice"] = 95;
scores["Bob"] = 88;
scores["Charlie"] = 92;

// Access
std::cout << scores["Alice"] << "\n";   // 95
std::cout << scores.at("Bob") << "\n";  // 88 (bounds-checked)

// Check existence
if (scores.count("Dave") == 0) {
    std::cout << "Dave not found\n";
}
if (scores.find("Alice") != scores.end()) {
    std::cout << "Alice found\n";
}

// Iteration (sorted by key)
for (const auto& [name, score] : scores) {
    std::cout << name << ": " << score << "\n";
}
```

---

## `std::unordered_map` — Hash Map

O(1) average operations. No guaranteed order.

```cpp
#include <unordered_map>

std::unordered_map<std::string, int> freq;
freq["hello"]++;
freq["world"]++;
freq["hello"]++;

std::cout << freq["hello"] << "\n";  // 2
```

Use `unordered_map` when order doesn't matter and you need O(1) lookups.

---

## `std::set` and `std::unordered_set`

Stores unique elements.

```cpp
#include <set>

std::set<int> s = {5, 3, 1, 4, 1, 5};  // {1, 3, 4, 5} — sorted, unique
s.insert(2);
s.erase(3);

bool has = s.count(4) > 0;  // or s.find(4) != s.end()
```

---

## `std::deque` — Double-Ended Queue

Efficient push/pop at both ends.

```cpp
#include <deque>
std::deque<int> dq = {2, 3, 4};
dq.push_front(1);   // {1, 2, 3, 4}
dq.push_back(5);    // {1, 2, 3, 4, 5}
dq.pop_front();     // {2, 3, 4, 5}
```

---

## Choosing a Container

| Need                         | Container       |
| ---------------------------- | --------------- |
| Random access, dynamic size  | `vector`        |
| Sorted key-value store       | `map`           |
| Fast key-value lookup        | `unordered_map` |
| Unique sorted elements       | `set`           |
| Fast push/pop at both ends   | `deque`         |
| Fast insert/remove in middle | `list`          |
| Fixed-size array             | `array<T, N>`   |

---

## Key Takeaways

1. `vector` is the go-to container — prefer it by default
2. `map` for sorted key-value; `unordered_map` for O(1) lookup
3. Use `at()` for bounds-checked access, `[]` for performance
4. C++17 **structured bindings** `auto& [key, val]` for clean map iteration
5. All STL containers manage their own memory (RAII)

---

## Next Steps

- **Algorithms** — std::sort, std::find, std::transform, and more
- **Iterators** — the glue between containers and algorithms
