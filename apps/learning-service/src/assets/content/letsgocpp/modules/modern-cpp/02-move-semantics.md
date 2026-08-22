# Move Semantics

Move semantics (C++11) enable **transferring** resources from one object to another without copying, dramatically improving performance.

## The Problem: Expensive Copies

```cpp
std::vector<int> createBigVector() {
    std::vector<int> v(1000000);
    // ... fill it ...
    return v;  // Before C++11: copies 1M elements!
}

auto big = createBigVector();  // Before: copy. After: move (free!)
```

---

## lvalues and rvalues

- **lvalue** — has a name, can appear on the left side of `=`
- **rvalue** — temporary, no name, appears on the right side of `=`

```cpp
int x = 5;     // x is lvalue, 5 is rvalue
int y = x;     // y is lvalue, x is lvalue
int z = x + y; // z is lvalue, (x+y) is rvalue
```

---

## rvalue References (`T&&`)

An rvalue reference binds to a temporary:

```cpp
void process(int& x) { std::cout << "lvalue ref: " << x << "\n"; }
void process(int&& x) { std::cout << "rvalue ref: " << x << "\n"; }

int a = 5;
process(a);    // lvalue ref: 5
process(10);   // rvalue ref: 10
process(a + 3); // rvalue ref: 8
```

---

## Move Constructor and Move Assignment

```cpp
class Buffer {
    size_t size_;
    char* data_;
public:
    // Constructor
    Buffer(size_t size) : size_(size), data_(new char[size]) {}

    // Destructor
    ~Buffer() { delete[] data_; }

    // Copy constructor (expensive)
    Buffer(const Buffer& other) : size_(other.size_), data_(new char[other.size_]) {
        std::memcpy(data_, other.data_, size_);
    }

    // Move constructor (cheap — just transfer the pointer)
    Buffer(Buffer&& other) noexcept
        : size_(other.size_), data_(other.data_) {
        other.size_ = 0;
        other.data_ = nullptr;  // leave source in valid but empty state
    }

    // Move assignment
    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            delete[] data_;         // free current resource
            size_ = other.size_;
            data_ = other.data_;
            other.size_ = 0;
            other.data_ = nullptr;
        }
        return *this;
    }
};

Buffer b1(1024);
Buffer b2(std::move(b1));  // move construct — b1 is now empty
```

---

## `std::move`

`std::move` is a cast that converts an lvalue to an rvalue reference, enabling move semantics:

```cpp
std::string s1 = "hello world";
std::string s2 = std::move(s1);  // s1 is now empty (or valid but unspecified)
// s2 = "hello world"
```

**Warning:** After `std::move`, don't use the source variable (it's in an unspecified state).

---

## Return Value Optimization (RVO)

Modern compilers often **eliminate copies entirely** through RVO/NRVO:

```cpp
std::vector<int> makeVec() {
    std::vector<int> v = {1, 2, 3, 4, 5};
    return v;  // NRVO: compiler constructs v directly in caller's space
}
```

Don't `return std::move(v)` — it disables RVO and can be slower!

---

## `std::forward` — Perfect Forwarding

```cpp
template<typename T>
void wrapper(T&& arg) {
    doWork(std::forward<T>(arg));  // forwards lvalue as lvalue, rvalue as rvalue
}
```

---

## Key Takeaways

1. **Move semantics** transfer resource ownership instead of copying
2. **lvalue** = named variable; **rvalue** = temporary
3. `T&&` is an rvalue reference — binds to temporaries
4. Move constructor/assignment: steal the pointer, nullify the source
5. `std::move(x)` casts x to rvalue — enables move semantics
6. After moving, the source is in a **valid but unspecified state**

---

## Next Steps

- **Concurrency** — use move semantics with threads
- **RAII** — move semantics make RAII types easier to use in containers
