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

  // ─── Gaps: lessons that had no exercise at all ────────────────────────────

  {
    id: 'oop-04',
    lessonSlug: 'polymorphism',
    title: 'Dispatch Through a Base Pointer',
    description:
      'Give Shape a virtual area, override it in both subclasses, and total a collection of mixed shapes held by base pointer.',
    starterCode: `#include <vector>
#include <memory>

class Shape {
public:
    // Make this virtual so a call through Shape* runs the derived version.
    // Give the class a virtual destructor too, or deleting through a
    // Shape* will not run the derived destructor.
    double area() const { return 0.0; }
};

class Square : public Shape {
public:
    explicit Square(double side) : side_(side) {}
    // Override area here.
private:
    double side_;
};

class Rect : public Shape {
public:
    Rect(double w, double h) : w_(w), h_(h) {}
    // Override area here.
private:
    double w_, h_;
};

// Sum the areas. Each element is a Shape* but a Square or Rect underneath,
// and virtual dispatch is what makes this add the right numbers.
double totalArea(const std::vector<std::unique_ptr<Shape>>& shapes) {

}`,
    testCode: `#include "catch_amalgamated.hpp"
#include <vector>
#include <memory>

TEST_CASE("totalArea adds mixed shapes", "[oop]") {
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Square>(3.0));
    shapes.push_back(std::make_unique<Rect>(2.0, 5.0));
    REQUIRE(totalArea(shapes) == Catch::Approx(19.0));
}

TEST_CASE("an empty collection totals zero", "[oop]") {
    std::vector<std::unique_ptr<Shape>> shapes;
    REQUIRE(totalArea(shapes) == Catch::Approx(0.0));
}

TEST_CASE("dispatch really is virtual", "[oop]") {
    // If area is not virtual this calls Shape::area and returns 0.
    std::unique_ptr<Shape> s = std::make_unique<Square>(4.0);
    REQUIRE(s->area() == Catch::Approx(16.0));
}`,
    hints: [
      'virtual double area() const { return 0.0; } in the base',
      'Add `virtual ~Shape() = default;` as well',
      'In each subclass write `double area() const override { ... }`',
      'override is not required but makes the compiler check you actually overrode something',
      'Loop the vector and accumulate s->area()',
    ],
    points: 25,
    difficulty: 'medium',
  },
  {
    id: 'memory-04',
    lessonSlug: 'stack-heap',
    title: 'Stack, Heap, and Who Frees It',
    description:
      'Two functions with the same job. One leaks and one cannot, and the difference is where the memory lives.',
    starterCode: `#include <vector>
#include <numeric>

// This allocates and never frees. Every call leaks the array.
// Rewrite it so nothing is allocated at all: the values are needed only
// for the length of the call, so they belong on the stack.
int sumLeaky(int count) {
    int* values = new int[count];
    for (int i = 0; i < count; ++i) values[i] = i + 1;
    int total = 0;
    for (int i = 0; i < count; ++i) total += values[i];
    return total;  // values is never deleted
}

// Now the case where the heap is the right answer: the caller decides the
// size at runtime and keeps the result. Return a vector, which owns its
// buffer and frees it when the caller is done.
std::vector<int> firstN(int count) {

}`,
    testCode: `#include "catch_amalgamated.hpp"
#include <vector>

TEST_CASE("sumLeaky still adds up", "[memory]") {
    REQUIRE(sumLeaky(4) == 10);
    REQUIRE(sumLeaky(1) == 1);
    REQUIRE(sumLeaky(0) == 0);
}

TEST_CASE("sumLeaky no longer calls new", "[memory]") {
    // Called many times: a leak here would be obvious under a sanitiser,
    // and a stack version costs nothing.
    long long total = 0;
    for (int i = 0; i < 1000; ++i) total += sumLeaky(10);
    REQUIRE(total == 55000);
}

TEST_CASE("firstN returns the numbers", "[memory]") {
    REQUIRE(firstN(4) == std::vector<int>{1, 2, 3, 4});
    REQUIRE(firstN(0).empty());
}`,
    hints: [
      'For sumLeaky, you do not need a container at all: add i + 1 as you go',
      'If you want one, std::vector<int> values(count) allocates and frees itself',
      'For firstN, build a std::vector<int> and return it',
      'Returning a vector by value does not copy the buffer; it is moved',
      'The rule: stack when the value dies with the call, heap when it outlives it or the size is unknown',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'memory-03',
    lessonSlug: 'raii',
    title: 'Write a RAII Guard',
    description:
      'Make a type that acquires in its constructor and releases in its destructor, so the release cannot be forgotten or skipped by an early return.',
    starterCode: `#include <vector>

// A tiny stand-in for a real resource.
inline std::vector<const char*>& log() {
    static std::vector<const char*> entries;
    return entries;
}

// Build a guard that appends "open" when constructed and "close" when
// destroyed. That is the whole of RAII: tie the lifetime of the resource
// to the lifetime of an object, and let scope do the work.
//
// It must also not be copyable. Two guards owning one resource would
// release it twice, which is the same bug as a double free.
class Guard {

};`,
    testCode: `#include "catch_amalgamated.hpp"
#include <vector>
#include <string>

TEST_CASE("the guard opens and closes with its scope", "[memory]") {
    log().clear();
    {
        Guard g;
        REQUIRE(log().size() == 1);
        REQUIRE(std::string(log()[0]) == "open");
    }
    REQUIRE(log().size() == 2);
    REQUIRE(std::string(log()[1]) == "close");
}

TEST_CASE("it closes even when the scope exits early", "[memory]") {
    log().clear();
    auto run = [](bool bail) {
        Guard g;
        if (bail) return;
    };
    run(true);
    REQUIRE(log().size() == 2);
    REQUIRE(std::string(log()[1]) == "close");
}

TEST_CASE("the guard cannot be copied", "[memory]") {
    REQUIRE_FALSE(std::is_copy_constructible<Guard>::value);
}`,
    hints: [
      'Guard() { log().push_back("open"); } is the constructor',
      '~Guard() { log().push_back("close"); } is the destructor',
      'Delete the copy operations: Guard(const Guard&) = delete;',
      'And Guard& operator=(const Guard&) = delete;',
      'The destructor runs on every exit from the scope, including an early return or a thrown exception, which is the point',
    ],
    points: 30,
    difficulty: 'hard',
  },
  {
    id: 'stl-04',
    lessonSlug: 'iterators',
    title: 'Walk With Iterators',
    description:
      'Sum a vector using an explicit iterator loop rather than a range-for, so the begin/end pair is doing visible work.',
    starterCode: `#include <vector>

// Add up every element, using an iterator rather than an index or a
// range-for. begin() points at the first element and end() points one
// past the last, which is why the loop condition is != end().
int sumWith(const std::vector<int>& v) {

}

// Return the number of elements strictly greater than threshold, again
// using iterators.
int countAbove(const std::vector<int>& v, int threshold) {

}`,
    testCode: `#include "catch_amalgamated.hpp"
#include <vector>

TEST_CASE("sumWith adds every element", "[stl]") {
    REQUIRE(sumWith({1, 2, 3, 4}) == 10);
    REQUIRE(sumWith({}) == 0);
    REQUIRE(sumWith({-2, 2}) == 0);
}

TEST_CASE("countAbove counts what is bigger", "[stl]") {
    REQUIRE(countAbove({1, 5, 3, 9}, 3) == 2);
    REQUIRE(countAbove({1, 2}, 10) == 0);
    REQUIRE(countAbove({}, 0) == 0);
}`,
    hints: [
      'for (auto it = v.begin(); it != v.end(); ++it) { ... }',
      '*it is the element the iterator points at',
      'Use const_iterator implicitly by taking v as a const reference, which is already done for you',
      'end() is one past the last element, so it is never dereferenced',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'templates-04',
    lessonSlug: 'template-specialization',
    title: 'Specialise a Template',
    description:
      'Write a general template, then a full specialisation for one type that needs to behave differently.',
    starterCode: `#include <string>

// The general case: describe any type as "value".
template <typename T>
std::string describe(T value) {
    return "value";
}

// Add a full specialisation for bool that returns "true" or "false".
// A full specialisation names the concrete type and takes no template
// parameters of its own.


// And one for std::string that returns the string itself.
`,
    testCode: `#include "catch_amalgamated.hpp"
#include <string>

TEST_CASE("the general template still handles other types", "[templates]") {
    REQUIRE(describe(42) == "value");
    REQUIRE(describe(3.5) == "value");
}

TEST_CASE("bool is specialised", "[templates]") {
    REQUIRE(describe(true) == "true");
    REQUIRE(describe(false) == "false");
}

TEST_CASE("std::string is specialised", "[templates]") {
    REQUIRE(describe(std::string("hello")) == "hello");
}`,
    hints: [
      'template <> std::string describe<bool>(bool value) { ... }',
      'The empty angle brackets say this is a full specialisation',
      'Return value ? "true" : "false"',
      'The std::string one returns its argument unchanged',
    ],
    points: 25,
    difficulty: 'hard',
  },
  {
    id: 'modern-04',
    lessonSlug: 'concurrency',
    title: 'Guard a Shared Counter',
    description:
      'Four threads increment one counter a thousand times each. Without a lock the total is wrong and varies run to run; with one it is 4000 every time.',
    starterCode: `#include <thread>
#include <mutex>
#include <vector>

// Increment counter 1000 times from each of four threads, and return the
// total. Unsynchronised ++ is a data race: reading, adding and writing
// are separate steps, and two threads interleaving them lose updates.
//
// Protect it with the mutex. Prefer std::lock_guard over calling lock()
// and unlock() yourself, so the mutex is released even if the body
// returns early or throws.
int countToFourThousand() {
    int counter = 0;
    std::mutex m;
    std::vector<std::thread> threads;



    return counter;
}`,
    testCode: `#include "catch_amalgamated.hpp"

TEST_CASE("the count is exact every time", "[modern]") {
    // Run it repeatedly: a missing lock often passes once by luck.
    for (int attempt = 0; attempt < 20; ++attempt) {
        REQUIRE(countToFourThousand() == 4000);
    }
}`,
    hints: [
      'threads.emplace_back([&]{ ... }); starts a thread capturing by reference',
      'Inside the loop body: std::lock_guard<std::mutex> guard(m); then ++counter;',
      'The guard locks on construction and unlocks when it goes out of scope',
      'Join every thread before reading the counter, or you read it while they are still running',
      'for (auto& t : threads) t.join();',
    ],
    points: 30,
    difficulty: 'hard',
  },
];

export function getChallengesForLesson(lessonSlug: string): CodeChallenge[] {
  return challenges.filter((c) => c.lessonSlug === lessonSlug);
}

export function getChallengeById(id: string): CodeChallenge | undefined {
  return challenges.find((c) => c.id === id);
}
