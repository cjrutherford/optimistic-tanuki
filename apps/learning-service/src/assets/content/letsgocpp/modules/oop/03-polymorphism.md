# Polymorphism

Polymorphism allows objects of different types to be treated uniformly through a common interface. C++ supports both **compile-time** (templates, overloading) and **runtime** (virtual functions) polymorphism.

## Runtime Polymorphism with Virtual Functions

```cpp
#include <vector>
#include <memory>
#include <iostream>

class Shape {
public:
    virtual double area() const = 0;       // pure virtual
    virtual std::string describe() const { // virtual with default
        return "A shape with area " + std::to_string(area());
    }
    virtual ~Shape() = default;
};

class Circle : public Shape {
    double r_;
public:
    Circle(double r) : r_(r) {}
    double area() const override { return 3.14159 * r_ * r_; }
};

class Rectangle : public Shape {
    double w_, h_;
public:
    Rectangle(double w, double h) : w_(w), h_(h) {}
    double area() const override { return w_ * h_; }
};
```

### Polymorphic Usage via Pointers/References

```cpp
void printArea(const Shape& shape) {
    std::cout << "Area: " << shape.area() << "\n";  // runtime dispatch
}

Circle c(5.0);
Rectangle r(4.0, 6.0);
printArea(c);  // Area: 78.53975
printArea(r);  // Area: 24

// Collections of mixed shapes.
//
// This needs unique_ptr, which the memory module covers next. Enough to read
// it now: unique_ptr<Shape> owns a heap-allocated Shape and deletes it when it
// goes out of scope, so nothing here leaks and no delete is written by hand.
// make_unique<Circle>(3.0) builds a Circle and hands back that owning pointer.
//
// A plain vector<Shape> would not work, and the reason is the point of this
// lesson: every element of a vector is the same size, so storing a Circle in a
// vector<Shape> copies only the Shape part of it and discards the rest. That
// is called slicing, and it takes the virtual dispatch with it. Holding a
// pointer keeps the real object, and with it the behaviour.
std::vector<std::unique_ptr<Shape>> shapes;
shapes.push_back(std::make_unique<Circle>(3.0));
shapes.push_back(std::make_unique<Rectangle>(2.0, 5.0));

double totalArea = 0;
for (const auto& s : shapes) {
    totalArea += s->area();
}
```

---

## Pure Virtual Functions & Abstract Classes

A class with at least one **pure virtual** function (`= 0`) is **abstract** — you cannot instantiate it directly.

```cpp
class AbstractLogger {
public:
    virtual void log(const std::string& message) = 0;
    virtual ~AbstractLogger() = default;
};

class ConsoleLogger : public AbstractLogger {
public:
    void log(const std::string& msg) override {
        std::cout << "[LOG] " << msg << "\n";
    }
};

class FileLogger : public AbstractLogger {
    std::string filename_;
public:
    FileLogger(const std::string& f) : filename_(f) {}
    void log(const std::string& msg) override {
        // write to file...
    }
};

// AbstractLogger l; // ERROR: cannot instantiate abstract class
ConsoleLogger cl;
cl.log("System started");
```

---

## How Virtual Dispatch Works (vtable)

When a class has virtual functions, the compiler creates a **virtual function table (vtable)**:

- Each object stores a hidden pointer (vptr) to its class's vtable
- Virtual calls look up the function through the vtable at runtime
- This adds a small overhead (~one pointer dereference)

```cpp
Shape* s = new Circle(5.0);
s->area();   // looks up Circle::area via vtable
delete s;    // calls ~Circle() then ~Shape() if destructors are virtual
```

**Why virtual destructor matters:**

```cpp
Shape* s = new Circle(5.0);
delete s;  // Without virtual ~Shape(), only ~Shape() is called → resource leak!
```

---

## Compile-Time Polymorphism (CRTP)

The **Curiously Recurring Template Pattern** achieves polymorphism without vtable overhead:

```cpp
template<typename Derived>
class ShapeBase {
public:
    double area() const {
        return static_cast<const Derived*>(this)->areaImpl();
    }
};

class Square : public ShapeBase<Square> {
    double side_;
public:
    Square(double s) : side_(s) {}
    double areaImpl() const { return side_ * side_; }
};
```

---

## Key Takeaways

1. **Virtual functions** enable runtime dispatch (calling derived method through base pointer)
2. **Pure virtual** (`= 0`) makes a class abstract — cannot be instantiated
3. Always declare a **virtual destructor** in polymorphic base classes
4. Use `override` to ensure you're actually overriding (compiler checks)
5. **vtable** is the mechanism — small overhead per virtual call
6. Use **smart pointers** (`unique_ptr<Shape>`) for polymorphic ownership

---

## Next Steps

- **Smart Pointers** — safely manage polymorphic object lifetimes
- **Templates** — compile-time polymorphism and generic programming
