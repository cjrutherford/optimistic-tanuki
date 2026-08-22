# RAII — Resource Acquisition Is Initialization

RAII is one of the most important idioms in C++. It ties resource lifetime to object lifetime: **acquire in constructor, release in destructor**.

## The RAII Pattern

```cpp
class FileHandle {
    FILE* file_;
public:
    FileHandle(const char* path, const char* mode)
        : file_(fopen(path, mode)) {
        if (!file_) throw std::runtime_error("Failed to open file");
    }

    ~FileHandle() {
        if (file_) fclose(file_);  // automatic cleanup
    }

    // Prevent copying (ownership semantics)
    FileHandle(const FileHandle&) = delete;
    FileHandle& operator=(const FileHandle&) = delete;

    FILE* get() { return file_; }
};

{
    FileHandle f("data.txt", "r");  // acquire
    // ... use f.get() to read ...
}   // destructor called → file closed automatically
    // even if an exception is thrown!
```

---

## Why RAII is Powerful

Without RAII (error-prone):

```cpp
FILE* f = fopen("data.txt", "r");
// ... lots of code ...
if (error) {
    fclose(f);  // easy to forget!
    return;
}
// ... more code ...
fclose(f);  // must close in every exit path
```

With RAII:

```cpp
FileHandle f("data.txt", "r");
// ... code ...
// f is ALWAYS closed when it goes out of scope
```

---

## RAII in the Standard Library

The entire C++ standard library is built on RAII:

| RAII Wrapper      | Resource             |
| ----------------- | -------------------- |
| `std::unique_ptr` | Heap memory          |
| `std::shared_ptr` | Heap memory (shared) |
| `std::fstream`    | File handles         |
| `std::lock_guard` | Mutex locks          |
| `std::vector`     | Heap buffer          |

---

## Lock Guard Example

```cpp
#include <mutex>
#include <thread>

std::mutex mtx;
int counter = 0;

void increment() {
    std::lock_guard<std::mutex> lock(mtx);  // acquires mutex
    ++counter;
}   // lock destructor releases mutex automatically
```

---

## Implementing RAII

A complete RAII wrapper follows the "Rule of Five":

```cpp
template<typename T>
class RAIIWrapper {
    T* resource_;
public:
    // Acquire
    explicit RAIIWrapper(T* r) : resource_(r) {}

    // Release
    ~RAIIWrapper() { delete resource_; }

    // Move (transfer ownership)
    RAIIWrapper(RAIIWrapper&& other) noexcept
        : resource_(other.resource_) {
        other.resource_ = nullptr;
    }

    RAIIWrapper& operator=(RAIIWrapper&& other) noexcept {
        if (this != &other) {
            delete resource_;
            resource_ = other.resource_;
            other.resource_ = nullptr;
        }
        return *this;
    }

    // No copying
    RAIIWrapper(const RAIIWrapper&) = delete;
    RAIIWrapper& operator=(const RAIIWrapper&) = delete;

    T* get() { return resource_; }
};
```

---

## Key Takeaways

1. **RAII** = constructor acquires, destructor releases
2. Resources are freed **automatically** when the object goes out of scope
3. Works even in the presence of **exceptions**
4. The entire C++ standard library uses RAII
5. Smart pointers are the most common application of RAII
6. Prefer RAII over manual resource management

---

## Next Steps

- **Containers** — STL containers are RAII wrappers around heap buffers
- **Move Semantics** — efficiently transfer RAII ownership
