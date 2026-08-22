export interface CodeChallenge {
  id: string;
  lessonSlug: string;
  title: string;
  description: string;
  starterCode: string;
  testCode: string;
  hints: string[];
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Build the full code that will be compiled and run on the server.
 * The user's starter code (with their implementation) is combined with
 * the Catch2 test harness so real assertions validate correctness.
 */
export function buildTestCode(
  challenge: CodeChallenge,
  userCode: string
): string {
  return `${userCode}

${challenge.testCode}`;
}

export const challenges: CodeChallenge[] = [
  // ─── BASICS MODULE ────────────────────────────────────────────────────────

  {
    id: 'basics-01',
    lessonSlug: 'hello-world',
    title: 'Hello, World!',
    description:
      'Write a complete C++ program that prints "Hello, World!" to standard output.',
    starterCode: `#include <iostream>

int main() {
    // TODO: print "Hello, World!"
    return 0;
}`,
    testCode: ``,
    hints: [
      'Use std::cout to write to standard output',
      'std::endl or "\\n" ends the line',
      "Don't forget #include <iostream>",
    ],
    points: 10,
    difficulty: 'easy',
  },

  {
    id: 'basics-02',
    lessonSlug: 'variables-types',
    title: 'Sum of Two Integers',
    description:
      'Implement a function `int add(int a, int b)` that returns the sum of two integers.',
    starterCode: `#include <iostream>

// TODO: implement add
int add(int a, int b) {
    return 0; // replace with your implementation
}`,
    testCode: `#include "catch_amalgamated.hpp"

TEST_CASE("add returns correct sum", "[basics]") {
    REQUIRE(add(2, 3) == 5);
    REQUIRE(add(-1, 1) == 0);
    REQUIRE(add(0, 0) == 0);
    REQUIRE(add(100, -50) == 50);
}`,
    hints: [
      'Simply return a + b',
      'Make sure your function signature matches exactly: int add(int a, int b)',
    ],
    points: 10,
    difficulty: 'easy',
  },

  {
    id: 'basics-03',
    lessonSlug: 'variables-types',
    title: 'Absolute Value',
    description:
      'Implement `double absoluteValue(double x)` that returns the absolute value of x without using std::abs.',
    starterCode: `// TODO: implement absoluteValue
double absoluteValue(double x) {
    return 0.0; // replace with your implementation
}`,
    testCode: `#include "catch_amalgamated.hpp"

TEST_CASE("absoluteValue works correctly", "[basics]") {
    REQUIRE(absoluteValue(5.0) == Catch::Approx(5.0));
    REQUIRE(absoluteValue(-5.0) == Catch::Approx(5.0));
    REQUIRE(absoluteValue(0.0) == Catch::Approx(0.0));
    REQUIRE(absoluteValue(-3.14) == Catch::Approx(3.14));
}`,
    hints: [
      'If x < 0, return -x; otherwise return x',
      'A ternary works nicely here: return x < 0 ? -x : x',
    ],
    points: 15,
    difficulty: 'easy',
  },

  {
    id: 'basics-04',
    lessonSlug: 'functions',
    title: 'Factorial',
    description:
      'Implement `long long factorial(int n)` that returns n! (n factorial). Assume n >= 0.',
    starterCode: `// TODO: implement factorial
// factorial(0) == 1, factorial(5) == 120
long long factorial(int n) {
    return 0; // replace with your implementation
}`,
    testCode: `#include "catch_amalgamated.hpp"

TEST_CASE("factorial computes correctly", "[basics]") {
    REQUIRE(factorial(0) == 1);
    REQUIRE(factorial(1) == 1);
    REQUIRE(factorial(5) == 120);
    REQUIRE(factorial(10) == 3628800LL);
}`,
    hints: [
      'Base case: factorial(0) = 1',
      'Recursive: n * factorial(n-1)',
      'Or iterative: multiply 1..n together',
    ],
    points: 15,
    difficulty: 'easy',
  },

  {
    id: 'basics-05',
    lessonSlug: 'control-flow',
    title: 'FizzBuzz',
    description:
      'Implement `std::string fizzBuzz(int n)` that returns "Fizz" for multiples of 3, "Buzz" for multiples of 5, "FizzBuzz" for multiples of both, and the number as string otherwise.',
    starterCode: `#include <string>

// TODO: implement fizzBuzz
std::string fizzBuzz(int n) {
    return ""; // replace with your implementation
}`,
    testCode: `#include "catch_amalgamated.hpp"
#include <string>

TEST_CASE("fizzBuzz returns correct strings", "[basics]") {
    REQUIRE(fizzBuzz(1) == "1");
    REQUIRE(fizzBuzz(3) == "Fizz");
    REQUIRE(fizzBuzz(5) == "Buzz");
    REQUIRE(fizzBuzz(15) == "FizzBuzz");
    REQUIRE(fizzBuzz(9) == "Fizz");
    REQUIRE(fizzBuzz(10) == "Buzz");
    REQUIRE(fizzBuzz(30) == "FizzBuzz");
    REQUIRE(fizzBuzz(7) == "7");
}`,
    hints: [
      'Check n % 15 == 0 FIRST for FizzBuzz',
      'Use std::to_string(n) to convert int to string',
      'Order of checks matters: 15, then 3, then 5, then default',
    ],
    points: 15,
    difficulty: 'easy',
  },

  {
    id: 'basics-06',
    lessonSlug: 'pointers-references',
    title: 'Swap via References',
    description:
      'Implement `void swap(int& a, int& b)` that swaps the values of two integers using references.',
    starterCode: `// TODO: implement swap using references
void swap(int& a, int& b) {
    // swap a and b
}`,
    testCode: `#include "catch_amalgamated.hpp"

TEST_CASE("swap exchanges values", "[basics]") {
    int x = 10, y = 20;
    swap(x, y);
    REQUIRE(x == 20);
    REQUIRE(y == 10);

    int a = 0, b = -5;
    swap(a, b);
    REQUIRE(a == -5);
    REQUIRE(b == 0);
}`,
    hints: [
      'Use a temporary variable: int temp = a; a = b; b = temp;',
      'Or use std::swap internally: std::swap(a, b)',
      "References allow you to modify the caller's variables directly",
    ],
    points: 15,
    difficulty: 'easy',
  },

  // ─── OOP MODULE ───────────────────────────────────────────────────────────

  {
    id: 'oop-01',
    lessonSlug: 'classes-objects',
    title: 'Rectangle Class',
    description:
      'Implement a `Rectangle` class with width and height. Add `area()` and `perimeter()` methods.',
    starterCode: `// TODO: implement the Rectangle class
class Rectangle {
    // Add width and height as private members
    // Add constructor(double width, double height)
    // Add area() -> double
    // Add perimeter() -> double
};`,
    testCode: `#include "catch_amalgamated.hpp"

TEST_CASE("Rectangle area and perimeter", "[oop]") {
    Rectangle r(4.0, 5.0);
    REQUIRE(r.area() == Catch::Approx(20.0));
    REQUIRE(r.perimeter() == Catch::Approx(18.0));

    Rectangle square(3.0, 3.0);
    REQUIRE(square.area() == Catch::Approx(9.0));
    REQUIRE(square.perimeter() == Catch::Approx(12.0));
}`,
    hints: [
      'Use private: double width_, height_; in the class body',
      'Constructor: Rectangle(double w, double h) : width_(w), height_(h) {}',
      'area() returns width_ * height_',
      'perimeter() returns 2 * (width_ + height_)',
    ],
    points: 20,
    difficulty: 'medium',
  },

  {
    id: 'oop-02',
    lessonSlug: 'classes-objects',
    title: 'Stack Class',
    description:
      'Implement a `Stack<int>` class with push(), pop(), top(), isEmpty(), and size() methods using std::vector internally.',
    starterCode: `#include <vector>
#include <stdexcept>

// TODO: implement Stack class
class Stack {
    // Store elements in a std::vector<int>
    // push(int val)  - add to top
    // pop()          - remove from top (throw std::underflow_error if empty)
    // top() -> int   - peek at top (throw std::underflow_error if empty)
    // isEmpty() -> bool
    // size() -> int
};`,
    testCode: `#include "catch_amalgamated.hpp"
#include <stdexcept>

TEST_CASE("Stack basic operations", "[oop]") {
    Stack s;
    REQUIRE(s.isEmpty() == true);
    REQUIRE(s.size() == 0);

    s.push(1);
    s.push(2);
    s.push(3);

    REQUIRE(s.size() == 3);
    REQUIRE(s.top() == 3);
    REQUIRE(s.isEmpty() == false);

    s.pop();
    REQUIRE(s.top() == 2);
    REQUIRE(s.size() == 2);
}

TEST_CASE("Stack throws on empty", "[oop]") {
    Stack s;
    REQUIRE_THROWS_AS(s.pop(), std::underflow_error);
    REQUIRE_THROWS_AS(s.top(), std::underflow_error);
}`,
    hints: [
      'Use std::vector<int> data_; as a private member',
      'push: data_.push_back(val)',
      'pop: if empty throw std::underflow_error("stack is empty"), else data_.pop_back()',
      'top: if empty throw, else return data_.back()',
    ],
    points: 25,
    difficulty: 'medium',
  },

  {
    id: 'oop-03',
    lessonSlug: 'inheritance',
    title: 'Shape Hierarchy',
    description:
      'Create an abstract `Shape` base class with a pure virtual `area()` method. Then implement `Circle` and `Triangle` derived classes.',
    starterCode: `#include <cmath>

// TODO: implement Shape, Circle, Triangle
// Shape: abstract base with virtual double area() = 0
// Circle(double radius): area() = M_PI * r * r
// Triangle(double base, double height): area() = 0.5 * base * height`,
    testCode: `#include "catch_amalgamated.hpp"
#include <cmath>
#include <memory>

TEST_CASE("Circle area", "[oop]") {
    Circle c(5.0);
    REQUIRE(c.area() == Catch::Approx(M_PI * 25.0).epsilon(0.001));
}

TEST_CASE("Triangle area", "[oop]") {
    Triangle t(6.0, 4.0);
    REQUIRE(t.area() == Catch::Approx(12.0));
}

TEST_CASE("Shape polymorphism", "[oop]") {
    std::unique_ptr<Shape> s1 = std::make_unique<Circle>(1.0);
    std::unique_ptr<Shape> s2 = std::make_unique<Triangle>(2.0, 3.0);
    REQUIRE(s1->area() == Catch::Approx(M_PI).epsilon(0.001));
    REQUIRE(s2->area() == Catch::Approx(3.0));
}`,
    hints: [
      'class Shape { public: virtual double area() const = 0; virtual ~Shape() = default; };',
      'class Circle : public Shape { double r_; public: Circle(double r) : r_(r) {} double area() const override { return M_PI * r_ * r_; } };',
      'Make sure to use const on the area() override',
    ],
    points: 25,
    difficulty: 'medium',
  },

  // ─── MEMORY MODULE ────────────────────────────────────────────────────────

  {
    id: 'memory-01',
    lessonSlug: 'smart-pointers',
    title: 'Unique Pointer Factory',
    description:
      'Implement `makePoint(double x, double y)` that returns a `std::unique_ptr<Point>` where Point has x and y members.',
    starterCode: `#include <memory>

struct Point {
    double x, y;
    Point(double x, double y) : x(x), y(y) {}
};

// TODO: implement makePoint that returns unique_ptr<Point>
std::unique_ptr<Point> makePoint(double x, double y) {
    return nullptr; // replace with your implementation
}`,
    testCode: `#include "catch_amalgamated.hpp"
#include <memory>

TEST_CASE("makePoint creates valid unique_ptr", "[memory]") {
    auto p = makePoint(3.0, 4.0);
    REQUIRE(p != nullptr);
    REQUIRE(p->x == Catch::Approx(3.0));
    REQUIRE(p->y == Catch::Approx(4.0));
}

TEST_CASE("makePoint transfers ownership", "[memory]") {
    auto p1 = makePoint(1.0, 2.0);
    auto p2 = std::move(p1);
    REQUIRE(p1 == nullptr);
    REQUIRE(p2 != nullptr);
    REQUIRE(p2->x == Catch::Approx(1.0));
}`,
    hints: [
      'Use std::make_unique<Point>(x, y)',
      'std::make_unique is preferred over new for exception safety',
    ],
    points: 20,
    difficulty: 'medium',
  },

  {
    id: 'memory-02',
    lessonSlug: 'smart-pointers',
    title: 'Reference-Counted Resource',
    description:
      'Implement a `Resource` class that tracks how many shared owners it has using shared_ptr semantics.',
    starterCode: `#include <memory>
#include <string>

struct Resource {
    std::string name;
    explicit Resource(const std::string& n) : name(n) {}
};

// TODO: implement createShared() that returns shared_ptr<Resource>
// and getUseCount() that returns the use_count of the shared_ptr
std::shared_ptr<Resource> createShared(const std::string& name) {
    return nullptr;
}`,
    testCode: `#include "catch_amalgamated.hpp"
#include <memory>

TEST_CASE("shared_ptr reference counting", "[memory]") {
    auto r1 = createShared("MyResource");
    REQUIRE(r1 != nullptr);
    REQUIRE(r1->name == "MyResource");
    REQUIRE(r1.use_count() == 1);

    auto r2 = r1;  // copy increases refcount
    REQUIRE(r1.use_count() == 2);
    REQUIRE(r2.use_count() == 2);

    r2.reset();  // release r2's ownership
    REQUIRE(r1.use_count() == 1);
}`,
    hints: [
      'Use std::make_shared<Resource>(name)',
      'Copying a shared_ptr increments the reference count',
      'reset() decrements the reference count',
    ],
    points: 20,
    difficulty: 'medium',
  },

  // ─── STL MODULE ───────────────────────────────────────────────────────────

  {
    id: 'stl-01',
    lessonSlug: 'containers',
    title: 'Vector Operations',
    description:
      'Implement `std::vector<int> filterEven(const std::vector<int>& v)` that returns only the even numbers from the input vector.',
    starterCode: `#include <vector>

// TODO: return a new vector containing only even numbers from v
std::vector<int> filterEven(const std::vector<int>& v) {
    return {}; // replace with your implementation
}`,
    testCode: `#include "catch_amalgamated.hpp"
#include <vector>

TEST_CASE("filterEven returns even numbers", "[stl]") {
    std::vector<int> input = {1, 2, 3, 4, 5, 6};
    auto result = filterEven(input);
    REQUIRE(result == std::vector<int>{2, 4, 6});
}

TEST_CASE("filterEven with empty input", "[stl]") {
    REQUIRE(filterEven({}).empty());
}

TEST_CASE("filterEven with no evens", "[stl]") {
    REQUIRE(filterEven({1, 3, 5}).empty());
}

TEST_CASE("filterEven with all evens", "[stl]") {
    std::vector<int> input = {2, 4, 6, 8};
    auto result = filterEven(input);
    REQUIRE(result == input);
}`,
    hints: [
      'Loop through v, check if x % 2 == 0, then push_back to result',
      'Or use std::copy_if with a lambda: x % 2 == 0',
    ],
    points: 15,
    difficulty: 'easy',
  },

  {
    id: 'stl-02',
    lessonSlug: 'algorithms',
    title: 'Count Occurrences',
    description:
      'Implement `int countOccurrences(const std::vector<int>& v, int target)` using std::count.',
    starterCode: `#include <vector>
#include <algorithm>

// TODO: use std::count to count occurrences of target in v
int countOccurrences(const std::vector<int>& v, int target) {
    return 0;
}`,
    testCode: `#include "catch_amalgamated.hpp"
#include <vector>

TEST_CASE("countOccurrences counts correctly", "[stl]") {
    std::vector<int> v = {1, 2, 3, 2, 4, 2, 5};
    REQUIRE(countOccurrences(v, 2) == 3);
    REQUIRE(countOccurrences(v, 1) == 1);
    REQUIRE(countOccurrences(v, 9) == 0);
    REQUIRE(countOccurrences({}, 1) == 0);
}`,
    hints: [
      'std::count(v.begin(), v.end(), target) returns the count',
      "Don't forget #include <algorithm>",
    ],
    points: 10,
    difficulty: 'easy',
  },

  {
    id: 'stl-03',
    lessonSlug: 'algorithms',
    title: 'Word Frequency Map',
    description:
      'Implement `std::map<std::string, int> wordFreq(const std::vector<std::string>& words)` that counts how often each word appears.',
    starterCode: `#include <vector>
#include <map>
#include <string>

// TODO: count frequency of each word using a map
std::map<std::string, int> wordFreq(const std::vector<std::string>& words) {
    return {};
}`,
    testCode: `#include "catch_amalgamated.hpp"
#include <vector>
#include <map>
#include <string>

TEST_CASE("wordFreq counts correctly", "[stl]") {
    std::vector<std::string> words = {"hello", "world", "hello", "cpp", "hello"};
    auto freq = wordFreq(words);
    REQUIRE(freq["hello"] == 3);
    REQUIRE(freq["world"] == 1);
    REQUIRE(freq["cpp"] == 1);
}

TEST_CASE("wordFreq empty input", "[stl]") {
    REQUIRE(wordFreq({}).empty());
}`,
    hints: [
      'Iterate over words and do freq[word]++ for each word',
      'std::map uses operator[] which default-initializes missing keys to 0',
    ],
    points: 20,
    difficulty: 'medium',
  },

  // ─── TEMPLATES MODULE ─────────────────────────────────────────────────────

  {
    id: 'templates-01',
    lessonSlug: 'function-templates',
    title: 'Generic Max',
    description:
      'Implement a function template `maxOf(a, b)` that returns the larger of two values. It should work with int, double, and std::string.',
    starterCode: `// TODO: implement maxOf as a function template
// template<typename T>
// T maxOf(T a, T b) { ... }`,
    testCode: `#include "catch_amalgamated.hpp"
#include <string>

TEST_CASE("maxOf works with int", "[templates]") {
    REQUIRE(maxOf(3, 5) == 5);
    REQUIRE(maxOf(-1, -3) == -1);
    REQUIRE(maxOf(7, 7) == 7);
}

TEST_CASE("maxOf works with double", "[templates]") {
    REQUIRE(maxOf(3.14, 2.71) == Catch::Approx(3.14));
}

TEST_CASE("maxOf works with string", "[templates]") {
    using namespace std::string_literals;
    REQUIRE(maxOf("apple"s, "banana"s) == "banana"s);
}`,
    hints: [
      'template<typename T> T maxOf(T a, T b) { return a > b ? a : b; }',
      'The template parameter T is deduced automatically from the arguments',
    ],
    points: 20,
    difficulty: 'medium',
  },

  {
    id: 'templates-02',
    lessonSlug: 'class-templates',
    title: 'Generic Pair',
    description:
      'Implement a class template `Pair<T, U>` with first and second members and a swap() method.',
    starterCode: `// TODO: implement Pair<T, U> class template
// Members: T first; U second;
// Constructor: Pair(T f, U s)
// Method: void swap() - swaps first and second (only for Pair<T, T>)`,
    testCode: `#include "catch_amalgamated.hpp"
#include <string>

TEST_CASE("Pair stores values", "[templates]") {
    Pair<int, std::string> p(42, "hello");
    REQUIRE(p.first == 42);
    REQUIRE(p.second == "hello");
}

TEST_CASE("Pair<T,T> can be swapped", "[templates]") {
    Pair<int, int> p(1, 2);
    p.swap();
    REQUIRE(p.first == 2);
    REQUIRE(p.second == 1);
}

TEST_CASE("Pair with doubles", "[templates]") {
    Pair<double, double> p(3.14, 2.71);
    REQUIRE(p.first == Catch::Approx(3.14));
    p.swap();
    REQUIRE(p.first == Catch::Approx(2.71));
}`,
    hints: [
      'template<typename T, typename U> class Pair { public: T first; U second; ... };',
      'Constructor uses initializer list: Pair(T f, U s) : first(f), second(s) {}',
      'swap() just does: std::swap(first, second)',
    ],
    points: 25,
    difficulty: 'medium',
  },

  // ─── MODERN C++ MODULE ────────────────────────────────────────────────────

  {
    id: 'modern-01',
    lessonSlug: 'auto-lambdas',
    title: 'Lambda Sort',
    description:
      'Implement `sortDescending(std::vector<int>& v)` that sorts a vector in descending order using a lambda comparator.',
    starterCode: `#include <vector>
#include <algorithm>

// TODO: sort v in descending order using a lambda
void sortDescending(std::vector<int>& v) {
    // use std::sort with a lambda comparator
}`,
    testCode: `#include "catch_amalgamated.hpp"
#include <vector>

TEST_CASE("sortDescending orders correctly", "[modern]") {
    std::vector<int> v = {3, 1, 4, 1, 5, 9, 2, 6};
    sortDescending(v);
    REQUIRE(v == std::vector<int>{9, 6, 5, 4, 3, 2, 1, 1});
}

TEST_CASE("sortDescending handles empty", "[modern]") {
    std::vector<int> v;
    sortDescending(v);
    REQUIRE(v.empty());
}

TEST_CASE("sortDescending single element", "[modern]") {
    std::vector<int> v = {42};
    sortDescending(v);
    REQUIRE(v == std::vector<int>{42});
}`,
    hints: [
      'std::sort(v.begin(), v.end(), [](int a, int b){ return a > b; });',
      'The lambda [](int a, int b){ return a > b; } is a descending comparator',
    ],
    points: 15,
    difficulty: 'easy',
  },

  {
    id: 'modern-02',
    lessonSlug: 'auto-lambdas',
    title: 'Transform with Lambda',
    description:
      'Implement `squareAll(const std::vector<int>& v)` using std::transform and a lambda to return a new vector where each element is squared.',
    starterCode: `#include <vector>
#include <algorithm>

// TODO: return a new vector where each element is squared
std::vector<int> squareAll(const std::vector<int>& v) {
    return {};
}`,
    testCode: `#include "catch_amalgamated.hpp"
#include <vector>

TEST_CASE("squareAll squares elements", "[modern]") {
    std::vector<int> input = {1, 2, 3, 4, 5};
    auto result = squareAll(input);
    REQUIRE(result == std::vector<int>{1, 4, 9, 16, 25});
}

TEST_CASE("squareAll with negatives", "[modern]") {
    auto result = squareAll({-3, -2, -1, 0, 1});
    REQUIRE(result == std::vector<int>{9, 4, 1, 0, 1});
}

TEST_CASE("squareAll empty", "[modern]") {
    REQUIRE(squareAll({}).empty());
}`,
    hints: [
      'Create result with same size: std::vector<int> result(v.size())',
      'std::transform(v.begin(), v.end(), result.begin(), [](int x){ return x * x; })',
    ],
    points: 20,
    difficulty: 'medium',
  },

  {
    id: 'modern-03',
    lessonSlug: 'move-semantics',
    title: 'Move-Aware Buffer',
    description:
      'Implement a `Buffer` class that wraps a std::vector<char>. Add a move constructor and move assignment that leave the source empty.',
    starterCode: `#include <vector>
#include <cstddef>

class Buffer {
public:
    // TODO: implement:
    // - Constructor: Buffer(size_t size) - creates buffer of given size
    // - size() -> size_t
    // - Move constructor: Buffer(Buffer&& other) noexcept
    // - Move assignment: Buffer& operator=(Buffer&& other) noexcept
    // Use std::vector<char> data_ as the underlying storage
};`,
    testCode: `#include "catch_amalgamated.hpp"
#include <utility>

TEST_CASE("Buffer construction", "[modern]") {
    Buffer b(100);
    REQUIRE(b.size() == 100);
}

TEST_CASE("Buffer move constructor", "[modern]") {
    Buffer b1(50);
    Buffer b2(std::move(b1));
    REQUIRE(b2.size() == 50);
    REQUIRE(b1.size() == 0);  // moved-from is empty
}

TEST_CASE("Buffer move assignment", "[modern]") {
    Buffer b1(30);
    Buffer b2(10);
    b2 = std::move(b1);
    REQUIRE(b2.size() == 30);
    REQUIRE(b1.size() == 0);
}`,
    hints: [
      'std::vector already supports move semantics, so you can delegate to it',
      'Move constructor: Buffer(Buffer&& o) noexcept : data_(std::move(o.data_)) {}',
      'Move assignment: data_ = std::move(other.data_); return *this;',
    ],
    points: 25,
    difficulty: 'hard',
  },

  // ─── TESTING MODULE ───────────────────────────────────────────────────────

  {
    id: 'testing-01',
    lessonSlug: 'catch2-basics',
    title: 'Write Your First Test',
    description:
      'Implement `int multiply(int a, int b)` and write a TEST_CASE that verifies it works correctly for at least 3 cases including negative numbers and zero.',
    starterCode: `#include "catch_amalgamated.hpp"

// TODO: implement multiply
int multiply(int a, int b) {
    return 0;
}

// TODO: write a TEST_CASE named "multiply works" that tests at least:
// - multiply(3, 4) == 12
// - multiply(-2, 5) == -10
// - multiply(0, 99) == 0`,
    testCode: ``,
    hints: [
      'TEST_CASE("multiply works", "[testing]") { REQUIRE(multiply(3, 4) == 12); ... }',
      'The implementation is just: return a * b;',
      'Add REQUIRE for each case inside the TEST_CASE body',
    ],
    points: 20,
    difficulty: 'medium',
  },

  {
    id: 'testing-02',
    lessonSlug: 'test-cases',
    title: 'Sections and Fixtures',
    description:
      'Implement a `BankAccount` class with `deposit()`, `withdraw()`, and `balance()`. Write a TEST_CASE with SECTION blocks to test different scenarios.',
    starterCode: `#include "catch_amalgamated.hpp"
#include <stdexcept>

// TODO: implement BankAccount
// - BankAccount(double initialBalance)
// - void deposit(double amount) - adds amount
// - void withdraw(double amount) - subtracts; throws std::invalid_argument if insufficient funds
// - double balance() const

// TODO: write TEST_CASE with SECTION blocks for:
// - "deposit increases balance"
// - "withdraw decreases balance"
// - "overdraft throws exception"`,
    testCode: ``,
    hints: [
      'SECTION("name") { ... } blocks inside a TEST_CASE each run with a fresh state',
      'REQUIRE_THROWS_AS(expr, ExceptionType) checks that an exception is thrown',
      'Throw std::invalid_argument("insufficient funds") in withdraw when balance < amount',
    ],
    points: 25,
    difficulty: 'hard',
  },
];

export function getChallengesForLesson(lessonSlug: string): CodeChallenge[] {
  return challenges.filter((c) => c.lessonSlug === lessonSlug);
}

export function getChallengeById(id: string): CodeChallenge | undefined {
  return challenges.find((c) => c.id === id);
}
