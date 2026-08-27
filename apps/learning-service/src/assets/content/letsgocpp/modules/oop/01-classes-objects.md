# Classes & Objects

Classes are the cornerstone of Object-Oriented Programming in C++. They bundle data (members) and behavior (methods) into a single unit.

## Defining a Class

```cpp
class BankAccount {
private:
    std::string owner_;
    double balance_;

public:
    // Constructor
    BankAccount(const std::string& owner, double initialBalance)
        : owner_(owner), balance_(initialBalance) {}

    // Getters (const methods — don't modify the object)
    std::string owner() const { return owner_; }
    double balance() const { return balance_; }

    // Mutating methods
    void deposit(double amount) {
        if (amount > 0) balance_ += amount;
    }

    bool withdraw(double amount) {
        if (amount > 0 && balance_ >= amount) {
            balance_ -= amount;
            return true;
        }
        return false;
    }

    void print() const {
        std::cout << owner_ << ": $" << balance_ << "\n";
    }
};
```

## Access Specifiers

| Specifier   | Accessible from                  |
| ----------- | -------------------------------- |
| `public`    | Anywhere                         |
| `private`   | Only within the class            |
| `protected` | Within class and derived classes |

---

## Constructors

```cpp
class Point {
public:
    double x, y;

    // Default constructor
    Point() : x(0), y(0) {}

    // Parameterized constructor
    Point(double x, double y) : x(x), y(y) {}

    // Delegating constructor (C++11)
    Point(double v) : Point(v, v) {}
};

Point p1;          // (0, 0)
Point p2(3, 4);    // (3, 4)
Point p3(5.5);     // (5.5, 5.5)
```

### Member Initializer List

Always prefer initializer lists over assignment in constructor body:

```cpp
// Preferred
Point(double x, double y) : x_(x), y_(y) {}

// Avoid (initializes with default, then assigns)
Point(double x, double y) { x_ = x; y_ = y; }
```

---

## Destructors

Called automatically when an object goes out of scope:

```cpp
class Resource {
    int* data_;
    std::size_t size_;
public:
    explicit Resource(std::size_t size)
        : data_(new int[size]), size_(size) {}

    ~Resource() { delete[] data_; }  // cleanup

    // A class that owns raw memory must say what copying means. Say it here,
    // even if the answer is "you may not", or the compiler writes a copy that
    // duplicates the pointer and frees the same buffer twice.
    Resource(const Resource&) = delete;
    Resource& operator=(const Resource&) = delete;
};

{
    Resource r(100);  // allocates
}   // destructor called here automatically
```

Those two deleted lines are not decoration. Without them the compiler
generates a copy constructor that copies `data_` as a pointer, so two objects
believe they own one buffer and both destructors free it:

```cpp
Resource a(100);
Resource b = a;   // with the deletes: a compile error, which is what you want
                  // without them: both destructors call delete[] on the same
                  // pointer, and the second one corrupts the heap
```

Deleting the copy is the honest minimum. The next section is about what to do
when you actually want the class to be copyable or movable.

---

## The Rule of Five (Modern C++)

If you define any of these, consider defining all five:

1. Destructor
2. Copy constructor
3. Copy assignment
4. Move constructor (C++11)
5. Move assignment (C++11)

Or use `= default` and `= delete`:

```cpp
class NoCopy {
public:
    NoCopy() = default;
    NoCopy(const NoCopy&) = delete;           // no copying
    NoCopy& operator=(const NoCopy&) = delete;
};
```

---

## Operator Overloading

```cpp
class Vector2D {
public:
    double x, y;
    Vector2D(double x, double y) : x(x), y(y) {}

    Vector2D operator+(const Vector2D& other) const {
        return {x + other.x, y + other.y};
    }

    bool operator==(const Vector2D& other) const {
        return x == other.x && y == other.y;
    }
};

Vector2D v1{1, 2}, v2{3, 4};
Vector2D v3 = v1 + v2;  // {4, 6}
```

---

## Key Takeaways

1. Classes bundle **data** (members) and **behavior** (methods)
2. Use **private** for data, **public** for interface
3. Use **initializer lists** in constructors
4. **const methods** promise not to modify the object
5. Destructors handle cleanup automatically (RAII)
6. **Operator overloading** makes custom types feel natural

---

## Next Steps

- **Inheritance** — create class hierarchies
- **Polymorphism** — virtual functions and runtime dispatch
