# Inheritance

Inheritance lets a class **derive** from another, reusing and extending its interface and implementation.

## Basic Inheritance

```cpp
class Animal {
protected:
    std::string name_;

public:
    Animal(const std::string& name) : name_(name) {}

    void eat() const {
        std::cout << name_ << " is eating\n";
    }

    std::string name() const { return name_; }
};

class Dog : public Animal {
    std::string breed_;

public:
    Dog(const std::string& name, const std::string& breed)
        : Animal(name), breed_(breed) {}

    void bark() const {
        std::cout << name_ << " says: Woof!\n";
    }

    std::string breed() const { return breed_; }
};

Dog dog("Rex", "Labrador");
dog.eat();    // inherited: Rex is eating
dog.bark();   // Dog's own: Rex says: Woof!
```

---

## Access in Derived Classes

| Base member | `public` inheritance | `protected` inheritance | `private` inheritance |
| ----------- | -------------------- | ----------------------- | --------------------- |
| `public`    | `public`             | `protected`             | `private`             |
| `protected` | `protected`          | `protected`             | `private`             |
| `private`   | not accessible       | not accessible          | not accessible        |

Use `public` inheritance for **is-a** relationships (Dog is an Animal).

---

## Constructor Chaining

Derived classes must call the base constructor:

```cpp
class Vehicle {
    int year_;
    std::string make_;
public:
    Vehicle(int year, const std::string& make)
        : year_(year), make_(make) {}
    int year() const { return year_; }
    std::string make() const { return make_; }
};

class Car : public Vehicle {
    int doors_;
public:
    Car(int year, const std::string& make, int doors)
        : Vehicle(year, make), doors_(doors) {}  // call base constructor
    int doors() const { return doors_; }
};

Car c(2023, "Toyota", 4);
std::cout << c.make() << " " << c.year() << "\n";  // Toyota 2023
```

---

## Method Overriding

Derived classes can **override** base class methods. Use `virtual` in the base class:

```cpp
class Shape {
public:
    virtual double area() const = 0;   // pure virtual
    virtual std::string name() const { return "Shape"; }
    virtual ~Shape() = default;        // virtual destructor — IMPORTANT
};

class Circle : public Shape {
    double radius_;
public:
    Circle(double r) : radius_(r) {}
    double area() const override { return 3.14159 * radius_ * radius_; }
    std::string name() const override { return "Circle"; }
};
```

**Always use `override`** to catch typos and mismatches at compile time.

**Always declare a `virtual` destructor** in base classes with virtual methods.

---

## Multiple Inheritance

C++ supports inheriting from multiple base classes:

```cpp
class Flyable {
public:
    virtual void fly() { std::cout << "Flying\n"; }
};

class Swimmable {
public:
    virtual void swim() { std::cout << "Swimming\n"; }
};

class Duck : public Animal, public Flyable, public Swimmable {
public:
    Duck(const std::string& name) : Animal(name) {}
};

Duck d("Donald");
d.fly();    // Flying
d.swim();   // Swimming
d.eat();    // inherited from Animal
```

**Diamond problem:** If two bases share a common base, use `virtual` inheritance.

---

## Key Takeaways

1. Use `public` inheritance for **is-a** relationships
2. Always declare a **virtual destructor** in polymorphic base classes
3. Use `override` keyword to catch overriding errors at compile time
4. Call the base constructor from derived constructor initializer list
5. `protected` members are accessible in derived classes but not outside

---

## Next Steps

- **Polymorphism** — runtime dispatch with virtual functions
- **Smart Pointers** — use unique_ptr/shared_ptr with polymorphic types
