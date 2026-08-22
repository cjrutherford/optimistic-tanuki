# Class Templates

Class templates let you define a generic class that works with any type. The entire STL (`vector<T>`, `map<K,V>`, `pair<T,U>`) is built on class templates.

## Basic Class Template

```cpp
template<typename T>
class Box {
    T value_;
public:
    explicit Box(T value) : value_(std::move(value)) {}
    T get() const { return value_; }
    void set(T value) { value_ = std::move(value); }
};

Box<int> intBox(42);
Box<std::string> strBox("hello");
Box<double> dblBox(3.14);

std::cout << intBox.get() << "\n";  // 42
std::cout << strBox.get() << "\n";  // hello
```

---

## Multiple Type Parameters

```cpp
template<typename K, typename V>
class KeyValue {
    K key_;
    V value_;
public:
    KeyValue(K k, V v) : key_(std::move(k)), value_(std::move(v)) {}
    K key() const { return key_; }
    V value() const { return value_; }
};

KeyValue<std::string, int> kv("age", 30);
std::cout << kv.key() << ": " << kv.value() << "\n";  // age: 30
```

---

## Generic Stack Implementation

```cpp
template<typename T>
class Stack {
    std::vector<T> data_;
public:
    void push(const T& item) { data_.push_back(item); }
    void push(T&& item) { data_.push_back(std::move(item)); }

    void pop() {
        if (empty()) throw std::underflow_error("stack is empty");
        data_.pop_back();
    }

    T& top() {
        if (empty()) throw std::underflow_error("stack is empty");
        return data_.back();
    }

    const T& top() const {
        if (empty()) throw std::underflow_error("stack is empty");
        return data_.back();
    }

    bool empty() const { return data_.empty(); }
    size_t size() const { return data_.size(); }
};

Stack<int> s;
s.push(1); s.push(2); s.push(3);
std::cout << s.top();  // 3
s.pop();
std::cout << s.top();  // 2

Stack<std::string> words;
words.push("hello");
words.push("world");
```

---

## Template Member Functions Defined Outside Class

```cpp
template<typename T>
class Wrapper {
    T data_;
public:
    Wrapper(T data);
    T data() const;
};

// Define outside — must repeat template<typename T>
template<typename T>
Wrapper<T>::Wrapper(T data) : data_(std::move(data)) {}

template<typename T>
T Wrapper<T>::data() const { return data_; }
```

---

## Class Template with Non-Type Parameter

```cpp
template<typename T, size_t N>
class FixedArray {
    T data_[N];
    size_t size_ = 0;
public:
    void push(const T& item) {
        if (size_ < N) data_[size_++] = item;
    }
    T& operator[](size_t i) { return data_[i]; }
    size_t size() const { return size_; }
    size_t capacity() const { return N; }
};

FixedArray<int, 10> arr;
arr.push(1); arr.push(2);
std::cout << arr[0] << " " << arr[1] << "\n";  // 1 2
```

---

## Key Takeaways

1. `template<typename T> class Foo { ... };` defines a generic class
2. Each unique instantiation (e.g., `Foo<int>`, `Foo<double>`) is a separate compiled class
3. Member function definitions outside the class need `template<typename T>` repeated
4. Class templates can have both type and non-type parameters
5. The STL containers (`vector`, `map`, `set`) are all class templates

---

## Next Steps

- **Template Specialization** — customize for specific types
- **Modern C++** — variadic templates and fold expressions
