# STL Algorithms

The `<algorithm>` header provides over 100 generic algorithms that work with any STL container via iterators.

## Searching

```cpp
#include <algorithm>
#include <vector>

std::vector<int> v = {3, 1, 4, 1, 5, 9, 2, 6};

// find — returns iterator to first match or end()
auto it = std::find(v.begin(), v.end(), 5);
if (it != v.end()) {
    std::cout << "Found: " << *it << "\n";
}

// find_if — find with predicate
auto even = std::find_if(v.begin(), v.end(), [](int x){ return x % 2 == 0; });

// count
int fives = std::count(v.begin(), v.end(), 5);  // 1

// any_of / all_of / none_of
bool hasNeg = std::any_of(v.begin(), v.end(), [](int x){ return x < 0; });
bool allPos = std::all_of(v.begin(), v.end(), [](int x){ return x > 0; });
```

---

## Sorting

```cpp
std::vector<int> v = {5, 2, 8, 1, 9, 3};

// Sort ascending
std::sort(v.begin(), v.end());   // {1, 2, 3, 5, 8, 9}

// Sort descending
std::sort(v.begin(), v.end(), [](int a, int b){ return a > b; });

// Stable sort (preserves relative order of equal elements)
std::stable_sort(v.begin(), v.end());

// Sort custom objects
struct Person { std::string name; int age; };
std::vector<Person> people = {{"Alice", 30}, {"Bob", 25}};
std::sort(people.begin(), people.end(), [](const Person& a, const Person& b){
    return a.age < b.age;
});
```

---

## Transforming

```cpp
std::vector<int> v = {1, 2, 3, 4, 5};
std::vector<int> squared(v.size());

// transform — apply function to each element
std::transform(v.begin(), v.end(), squared.begin(),
               [](int x){ return x * x; });
// squared = {1, 4, 9, 16, 25}

// In-place transform
std::transform(v.begin(), v.end(), v.begin(),
               [](int x){ return x * 2; });
// v = {2, 4, 6, 8, 10}
```

---

## Reducing / Accumulating

```cpp
#include <numeric>

std::vector<int> v = {1, 2, 3, 4, 5};

int sum = std::accumulate(v.begin(), v.end(), 0);  // 15
int product = std::accumulate(v.begin(), v.end(), 1,
                               [](int acc, int x){ return acc * x; }); // 120

// partial_sum
std::vector<int> running(v.size());
std::partial_sum(v.begin(), v.end(), running.begin());
// running = {1, 3, 6, 10, 15}
```

---

## Filtering (copy_if, remove_if)

```cpp
std::vector<int> v = {1, 2, 3, 4, 5, 6};
std::vector<int> evens;

// copy_if — copy elements matching predicate
std::copy_if(v.begin(), v.end(), std::back_inserter(evens),
             [](int x){ return x % 2 == 0; });
// evens = {2, 4, 6}

// Erase-Remove idiom
v.erase(std::remove_if(v.begin(), v.end(), [](int x){ return x % 2 == 0; }),
        v.end());
// v = {1, 3, 5}
```

---

## Other Useful Algorithms

```cpp
// min_element / max_element
auto minIt = std::min_element(v.begin(), v.end());
auto maxIt = std::max_element(v.begin(), v.end());

// reverse
std::reverse(v.begin(), v.end());

// unique (requires sorted input — removes consecutive duplicates)
std::sort(v.begin(), v.end());
auto last = std::unique(v.begin(), v.end());
v.erase(last, v.end());

// fill
std::fill(v.begin(), v.end(), 0);  // set all to 0

// for_each
std::for_each(v.begin(), v.end(), [](int x){ std::cout << x << " "; });
```

---

## Key Takeaways

1. `#include <algorithm>` for most algorithms; `#include <numeric>` for numeric ones
2. Algorithms work on **iterator ranges** `[begin, end)` — works with any container
3. **Lambdas** are the natural fit for predicates and comparators
4. The **erase-remove idiom** is how you remove elements from a vector
5. `std::ranges::` (C++20) provides cleaner syntax: `std::ranges::sort(v)`

---

## Next Steps

- **Iterators** — understand the glue between containers and algorithms
- **Modern C++** — ranges (C++20) for pipeline-style algorithm composition
