# Control Flow

C++ provides the standard control flow constructs: `if/else`, `switch`, `for`, `while`, and the range-based `for` loop.

## if / else if / else

```cpp
int score = 85;

if (score >= 90) {
    std::cout << "A\n";
} else if (score >= 80) {
    std::cout << "B\n";
} else if (score >= 70) {
    std::cout << "C\n";
} else {
    std::cout << "F\n";
}
// Outputs: B
```

### Initializer in if (C++17)

```cpp
if (int n = getValue(); n > 0) {
    std::cout << "Positive: " << n << "\n";
}
// n is scoped to the if block
```

---

## switch

```cpp
char grade = 'B';

switch (grade) {
    case 'A':
        std::cout << "Excellent!\n";
        break;
    case 'B':
        std::cout << "Good!\n";
        break;
    case 'C':
        std::cout << "Average\n";
        break;
    default:
        std::cout << "Below average\n";
        break;
}
```

**Always `break`** unless you intend fall-through. Use `[[fallthrough]]` attribute to make intentional fall-through explicit:

```cpp
switch (x) {
    case 1:
    case 2:
        std::cout << "1 or 2\n";
        break;
    case 3:
        std::cout << "3...\n";
        [[fallthrough]];  // intentional fall-through
    case 4:
        std::cout << "3 or 4\n";
        break;
}
```

---

## for Loop

### Classic for loop

```cpp
for (int i = 0; i < 10; i++) {
    std::cout << i << " ";
}
// 0 1 2 3 4 5 6 7 8 9
```

### Range-based for loop (C++11)

```cpp
std::vector<int> numbers = {1, 2, 3, 4, 5};

// Read-only iteration
for (int n : numbers) {
    std::cout << n << " ";
}

// Modifying elements
for (int& n : numbers) {
    n *= 2;
}

// Auto with const reference (preferred for large types)
for (const auto& n : numbers) {
    std::cout << n << " ";
}
```

---

## while and do-while

```cpp
// while — checks condition first
int i = 0;
while (i < 5) {
    std::cout << i++ << " ";
}
// 0 1 2 3 4

// do-while — always executes at least once
int j = 10;
do {
    std::cout << j << " ";
    j--;
} while (j > 0);
```

---

## break and continue

```cpp
for (int i = 0; i < 10; i++) {
    if (i == 3) continue;   // skip 3
    if (i == 7) break;      // stop at 7
    std::cout << i << " ";
}
// 0 1 2 4 5 6
```

---

## Ternary Operator

```cpp
int x = 10;
std::string result = (x > 0) ? "positive" : "non-positive";
```

---

## Key Takeaways

1. Use `if/else if/else` for multi-branch conditions
2. `switch` is efficient for discrete value matching
3. **Range-based for** is idiomatic C++ for container iteration
4. `break` exits a loop; `continue` skips the current iteration
5. C++17 if initializers scope variables tightly

---

## Next Steps

- **Pointers & References** — memory addressing and aliasing
- **Functions** — organize code into reusable blocks
