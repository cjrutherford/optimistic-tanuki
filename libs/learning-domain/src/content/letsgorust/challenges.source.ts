export interface CodeChallenge {
  id: string;
  lessonSlug: string;
  title: string;
  description: string;
  starterCode: string;
  /**
   * A `#[cfg(test)]` module appended to the learner's code.
   *
   * Be aware of what this does and does not buy you. The runner compiles with
   * `rustc` and runs the binary; it does not run `cargo test`, so a
   * `#[cfg(test)]` module is compiled out and its assertions never execute.
   * An exercise carrying only `testCode` is therefore graded on whether it
   * compiles and runs, not on whether it is right.
   *
   * Leave this empty and set `expectedOutput` instead when the exercise should
   * actually be checked. The runner only compares output when there is no test
   * code at all.
   */
  testCode: string;
  /** Exact stdout the finished exercise must produce. */
  expectedOutput?: string;
  hints: string[];
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const challenges: CodeChallenge[] = [
  // Basics module
  {
    id: 'basics-01',
    lessonSlug: 'hello-world',
    title: 'Hello, Rustacean!',
    description: 'Print "Hello, Rustacean!" to the console.',
    starterCode: `fn main() {
    // Your code here
}`,
    testCode: `
#[cfg(test)]
mod tests {
    #[test]
    fn test_compiles() {
        // Just compiling is enough for this challenge
        assert!(true);
    }
}`,
    hints: [
      'Use the println! macro to print text.',
      'println!("text") prints text followed by a newline.',
    ],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'basics-02',
    lessonSlug: 'variables-types',
    title: 'Variables and Mutability',
    description:
      'Create a mutable variable `count`, set it to 0, then increment it to 5 and return it from the function.',
    starterCode: `fn get_count() -> i32 {
    // Declare a mutable variable count = 0
    // Increment it 5 times
    // Return count
    0
}

fn main() {
    println!("{}", get_count());
}`,
    testCode: `
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_count() {
        assert_eq!(get_count(), 5, "get_count() should return 5");
    }
}`,
    hints: [
      'Use `let mut count = 0;` to declare a mutable variable.',
      'Use `count += 1;` to increment the variable.',
      'You can use a loop: `for _ in 0..5 { count += 1; }`',
    ],
    points: 15,
    difficulty: 'easy',
  },
  {
    id: 'basics-03',
    lessonSlug: 'functions',
    title: 'Adding Numbers',
    description:
      'Implement the `add` function that takes two i32 values and returns their sum.',
    starterCode: `fn add(a: i32, b: i32) -> i32 {
    // Return the sum of a and b
    0
}

fn main() {
    println!("{}", add(3, 4));
}`,
    testCode: `
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_positive() {
        assert_eq!(add(3, 4), 7);
    }

    #[test]
    fn test_add_negative() {
        assert_eq!(add(-1, 1), 0);
    }

    #[test]
    fn test_add_zeros() {
        assert_eq!(add(0, 0), 0);
    }
}`,
    hints: [
      'In Rust, the last expression in a function is the return value.',
      'You can write `a + b` without a semicolon to return it.',
    ],
    points: 15,
    difficulty: 'easy',
  },
  {
    id: 'basics-04',
    lessonSlug: 'control-flow',
    title: 'FizzBuzz',
    description:
      'Implement `fizzbuzz(n: u32) -> String` that returns "Fizz" if divisible by 3, "Buzz" if by 5, "FizzBuzz" if by both, else the number as a string.',
    starterCode: `fn fizzbuzz(n: u32) -> String {
    // Implement FizzBuzz logic
    String::new()
}

fn main() {
    for i in 1..=15 {
        println!("{}", fizzbuzz(i));
    }
}`,
    testCode: `
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fizz() {
        assert_eq!(fizzbuzz(3), "Fizz");
        assert_eq!(fizzbuzz(6), "Fizz");
    }

    #[test]
    fn test_buzz() {
        assert_eq!(fizzbuzz(5), "Buzz");
        assert_eq!(fizzbuzz(10), "Buzz");
    }

    #[test]
    fn test_fizzbuzz() {
        assert_eq!(fizzbuzz(15), "FizzBuzz");
        assert_eq!(fizzbuzz(30), "FizzBuzz");
    }

    #[test]
    fn test_number() {
        assert_eq!(fizzbuzz(1), "1");
        assert_eq!(fizzbuzz(7), "7");
    }
}`,
    hints: [
      'Check for FizzBuzz (divisible by both) first, before checking Fizz or Buzz.',
      'Use `%` for the modulo operator.',
      'Use `n.to_string()` to convert a number to a String.',
    ],
    points: 20,
    difficulty: 'easy',
  },
  // Ownership module
  {
    id: 'ownership-01',
    lessonSlug: 'ownership-rules',
    title: 'Ownership Transfer',
    description:
      'Fix the function so it returns ownership of the String back to the caller.',
    starterCode: `fn takes_and_gives_back(s: String) -> String {
    // Return s so ownership is transferred back
    String::new() // Fix this
}

fn main() {
    let s = String::from("hello");
    let s2 = takes_and_gives_back(s);
    println!("{}", s2);
}`,
    testCode: `
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_returns_same_string() {
        let input = String::from("hello");
        let result = takes_and_gives_back(input);
        assert_eq!(result, "hello");
    }

    #[test]
    fn test_returns_nonempty() {
        let input = String::from("rust");
        let result = takes_and_gives_back(input);
        assert!(!result.is_empty());
    }
}`,
    hints: [
      'Simply return `s` from the function.',
      'In Rust, returning a value transfers its ownership to the caller.',
    ],
    points: 20,
    difficulty: 'easy',
  },
  {
    id: 'ownership-02',
    lessonSlug: 'borrowing',
    title: 'Calculate String Length',
    description:
      'Implement `string_length` that borrows a String and returns its length without taking ownership.',
    starterCode: `fn string_length(s: &String) -> usize {
    // Return the length of s without taking ownership
    0
}

fn main() {
    let s = String::from("hello world");
    let len = string_length(&s);
    println!("Length of '{}' is {}", s, len);
}`,
    testCode: `
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_length() {
        let s = String::from("hello");
        assert_eq!(string_length(&s), 5);
    }

    #[test]
    fn test_empty() {
        let s = String::from("");
        assert_eq!(string_length(&s), 0);
    }

    #[test]
    fn test_ownership_retained() {
        let s = String::from("rust");
        let _len = string_length(&s);
        // s should still be usable after the call
        assert_eq!(s, "rust");
    }
}`,
    hints: [
      'Use `s.len()` to get the length of a String.',
      'Since we are borrowing, the caller keeps ownership.',
    ],
    points: 20,
    difficulty: 'easy',
  },
  // Structs module
  {
    id: 'structs-01',
    lessonSlug: 'structs',
    title: 'Rectangle Area',
    description:
      'Implement the `area` method on the `Rectangle` struct that returns width * height.',
    starterCode: `struct Rectangle {
    width: f64,
    height: f64,
}

impl Rectangle {
    fn area(&self) -> f64 {
        // Return the area of the rectangle
        0.0
    }
}

fn main() {
    let rect = Rectangle { width: 5.0, height: 3.0 };
    println!("Area: {}", rect.area());
}`,
    testCode: `
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_area() {
        let rect = Rectangle { width: 5.0, height: 3.0 };
        assert_eq!(rect.area(), 15.0);
    }

    #[test]
    fn test_square_area() {
        let rect = Rectangle { width: 4.0, height: 4.0 };
        assert_eq!(rect.area(), 16.0);
    }

    #[test]
    fn test_zero_area() {
        let rect = Rectangle { width: 0.0, height: 5.0 };
        assert_eq!(rect.area(), 0.0);
    }
}`,
    hints: [
      'Multiply `self.width` by `self.height`.',
      'Access struct fields using `self.field_name`.',
    ],
    points: 20,
    difficulty: 'easy',
  },
  {
    id: 'structs-02',
    lessonSlug: 'enums',
    title: 'Shape Area with Enums',
    description:
      'Implement `calculate_area` for the `Shape` enum that returns the area of a Circle or Rectangle.',
    starterCode: `use std::f64::consts::PI;

enum Shape {
    Circle(f64),           // radius
    Rectangle(f64, f64),   // width, height
}

fn calculate_area(shape: &Shape) -> f64 {
    // Use pattern matching to calculate area
    // Circle area = PI * r^2
    // Rectangle area = width * height
    0.0
}

fn main() {
    let c = Shape::Circle(3.0);
    let r = Shape::Rectangle(4.0, 5.0);
    println!("Circle area: {:.2}", calculate_area(&c));
    println!("Rectangle area: {:.2}", calculate_area(&r));
}`,
    testCode: `
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circle_area() {
        let circle = Shape::Circle(1.0);
        let area = calculate_area(&circle);
        assert!((area - PI).abs() < 1e-10, "Expected PI, got {}", area);
    }

    #[test]
    fn test_rectangle_area() {
        let rect = Shape::Rectangle(4.0, 5.0);
        assert_eq!(calculate_area(&rect), 20.0);
    }
}`,
    hints: [
      'Use a `match` statement to pattern match on the enum variants.',
      'For Circle: `Shape::Circle(r) => PI * r * r`',
      'For Rectangle: `Shape::Rectangle(w, h) => w * h`',
    ],
    points: 25,
    difficulty: 'medium',
  },
  // Error handling module
  {
    id: 'errors-01',
    lessonSlug: 'result-option',
    title: 'Safe Division',
    description:
      'Implement `safe_divide` that returns `Ok(result)` for valid division or `Err("division by zero")` when dividing by zero.',
    starterCode: `fn safe_divide(a: f64, b: f64) -> Result<f64, String> {
    // Return Ok(a / b) or Err("division by zero")
    Ok(0.0)
}

fn main() {
    match safe_divide(10.0, 2.0) {
        Ok(result) => println!("Result: {}", result),
        Err(e) => println!("Error: {}", e),
    }
}`,
    testCode: `
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_division() {
        assert_eq!(safe_divide(10.0, 2.0), Ok(5.0));
    }

    #[test]
    fn test_division_by_zero() {
        assert_eq!(safe_divide(5.0, 0.0), Err(String::from("division by zero")));
    }

    #[test]
    fn test_negative_division() {
        assert_eq!(safe_divide(-6.0, 3.0), Ok(-2.0));
    }
}`,
    hints: [
      'Check if `b == 0.0` and return `Err(String::from("division by zero"))` in that case.',
      'Otherwise return `Ok(a / b)`.',
    ],
    points: 25,
    difficulty: 'medium',
  },
  // Traits module
  {
    id: 'traits-01',
    lessonSlug: 'traits',
    title: 'Implement Display Trait',
    description:
      'Implement the `Greet` trait for `Person` so that `greet()` returns "Hello, my name is {name} and I am {age} years old."',
    starterCode: `trait Greet {
    fn greet(&self) -> String;
}

struct Person {
    name: String,
    age: u32,
}

impl Greet for Person {
    fn greet(&self) -> String {
        // Return the greeting string
        String::new()
    }
}

fn main() {
    let p = Person { name: String::from("Alice"), age: 30 };
    println!("{}", p.greet());
}`,
    testCode: `
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        let p = Person { name: String::from("Alice"), age: 30 };
        assert_eq!(p.greet(), "Hello, my name is Alice and I am 30 years old.");
    }

    #[test]
    fn test_greet_different_person() {
        let p = Person { name: String::from("Bob"), age: 25 };
        assert_eq!(p.greet(), "Hello, my name is Bob and I am 25 years old.");
    }
}`,
    hints: [
      'Use `format!()` macro to build the greeting string.',
      'Example: `format!("Hello, my name is {} and I am {} years old.", self.name, self.age)`',
    ],
    points: 25,
    difficulty: 'medium',
  },
  // Collections module
  {
    id: 'collections-01',
    lessonSlug: 'vectors',
    title: 'Sum a Vector',
    description:
      'Implement `sum_vec` that takes a reference to a Vec<i32> and returns the sum of all elements.',
    starterCode: `fn sum_vec(numbers: &Vec<i32>) -> i32 {
    // Return the sum of all elements in numbers
    0
}

fn main() {
    let nums = vec![1, 2, 3, 4, 5];
    println!("Sum: {}", sum_vec(&nums));
}`,
    testCode: `
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sum() {
        assert_eq!(sum_vec(&vec![1, 2, 3, 4, 5]), 15);
    }

    #[test]
    fn test_empty() {
        assert_eq!(sum_vec(&vec![]), 0);
    }

    #[test]
    fn test_negatives() {
        assert_eq!(sum_vec(&vec![-1, -2, 3]), 0);
    }
}`,
    hints: [
      'Use an iterator: `numbers.iter().sum()`',
      'Or use a for loop: `for &n in numbers { sum += n; }`',
    ],
    points: 20,
    difficulty: 'easy',
  },
  {
    id: 'collections-02',
    lessonSlug: 'iterators',
    title: 'Filter and Map',
    description:
      'Implement `even_squares` that takes a Vec<i32> and returns a Vec<i32> with the squares of all even numbers.',
    starterCode: `fn even_squares(numbers: Vec<i32>) -> Vec<i32> {
    // Filter even numbers, then square them
    // Return the resulting vector
    vec![]
}

fn main() {
    let nums = vec![1, 2, 3, 4, 5, 6];
    println!("{:?}", even_squares(nums));
}`,
    testCode: `
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_even_squares() {
        assert_eq!(even_squares(vec![1, 2, 3, 4, 5, 6]), vec![4, 16, 36]);
    }

    #[test]
    fn test_empty() {
        assert_eq!(even_squares(vec![]), vec![]);
    }

    #[test]
    fn test_all_odd() {
        assert_eq!(even_squares(vec![1, 3, 5]), vec![]);
    }
}`,
    hints: [
      'Use iterator chaining: `.iter().filter(...).map(...).collect()`',
      'Filter: `.filter(|&&x| x % 2 == 0)`',
      'Map to square: `.map(|&x| x * x)`',
    ],
    points: 25,
    difficulty: 'medium',
  },
  // Testing module
  {
    id: 'testing-01',
    lessonSlug: 'unit-tests',
    title: 'Temperature Converter',
    description:
      'Implement `celsius_to_fahrenheit(c: f64) -> f64` that converts Celsius to Fahrenheit using the formula F = C * 9/5 + 32.',
    starterCode: `fn celsius_to_fahrenheit(c: f64) -> f64 {
    // Convert Celsius to Fahrenheit
    // Formula: F = C * 9.0/5.0 + 32.0
    0.0
}

fn main() {
    println!("0°C = {}°F", celsius_to_fahrenheit(0.0));
    println!("100°C = {}°F", celsius_to_fahrenheit(100.0));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_freezing() {
        assert_eq!(celsius_to_fahrenheit(0.0), 32.0);
    }

    #[test]
    fn test_boiling() {
        assert_eq!(celsius_to_fahrenheit(100.0), 212.0);
    }

    #[test]
    fn test_body_temp() {
        let result = celsius_to_fahrenheit(37.0);
        assert!((result - 98.6).abs() < 0.01, "Expected ~98.6, got {}", result);
    }
}`,
    testCode: ``,
    hints: [
      'The formula is: F = C * 9.0/5.0 + 32.0',
      'Make sure to use floating point arithmetic (9.0/5.0, not 9/5).',
    ],
    points: 20,
    difficulty: 'easy',
  },
  {
    id: 'testing-02',
    lessonSlug: 'test-driven-dev',
    title: 'Fibonacci with TDD',
    description:
      'Implement `fibonacci(n: u64) -> u64` that returns the nth Fibonacci number (0-indexed: fib(0)=0, fib(1)=1, fib(2)=1, ...).',
    starterCode: `fn fibonacci(n: u64) -> u64 {
    // Implement fibonacci
    // fib(0) = 0, fib(1) = 1, fib(n) = fib(n-1) + fib(n-2)
    0
}

fn main() {
    for i in 0..10 {
        print!("{} ", fibonacci(i));
    }
    println!();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base_cases() {
        assert_eq!(fibonacci(0), 0);
        assert_eq!(fibonacci(1), 1);
    }

    #[test]
    fn test_fibonacci_sequence() {
        assert_eq!(fibonacci(2), 1);
        assert_eq!(fibonacci(3), 2);
        assert_eq!(fibonacci(4), 3);
        assert_eq!(fibonacci(5), 5);
        assert_eq!(fibonacci(6), 8);
        assert_eq!(fibonacci(10), 55);
    }
}`,
    testCode: ``,
    hints: [
      'Handle the base cases: if n == 0 return 0, if n == 1 return 1.',
      'For n > 1: return fibonacci(n-1) + fibonacci(n-2)',
      'Consider an iterative approach for better performance.',
    ],
    points: 30,
    difficulty: 'medium',
  },

  // Interior mutability
  {
    id: 'ownership-03',
    lessonSlug: 'interior-mutability',
    title: 'Mutate Through a Shared Reference',
    description:
      'A counter has to record hits through &self. Use interior mutability rather than changing the signature, then share one across two owners.',
    starterCode: `use std::cell::Cell;
use std::cell::RefCell;
use std::rc::Rc;

struct Counter {
    // A plain u32 cannot be changed through &self: the compiler rejects it
    // with E0594. Wrap it so it can. The value is small and Copy, so the
    // wrapper that needs no runtime borrow tracking is the right one here.
    hits: ,
}

impl Counter {
    fn new() -> Counter {
        Counter { hits: }
    }

    // Note the &self. Changing this to &mut self is the thing you are
    // avoiding, because callers only have a shared reference.
    fn record(&self) {

    }

    fn total(&self) -> u32 {

    }
}

fn main() {
    let counter = Counter::new();
    counter.record();
    counter.record();
    counter.record();
    println!("{}", counter.total());

    // Now a value two owners share and both mutate. Rc gives out shared
    // references only, so the inside needs to be mutable on its own.
    let shared: Rc<RefCell<Vec<i32>>> = Rc::new(RefCell::new(vec![1]));
    let second = Rc::clone(&shared);

    // Push 2 through the second handle.


    println!("{:?}", shared.borrow());
}`,
    testCode: ``,
    expectedOutput: '3\n[1, 2]',
    hints: [
      'Cell<u32> for the counter: set and get, with no borrow tracking and no way to panic',
      'self.hits.set(self.hits.get() + 1) records a hit',
      'Cell::new(0) in the constructor',
      'second.borrow_mut().push(2) mutates the shared vector',
      'Both handles see it, because Rc::clone copies the pointer rather than the data',
    ],
    points: 30,
    difficulty: 'hard',
  },

  // Pattern matching
  {
    id: 'structs-04',
    lessonSlug: 'pattern-matching',
    title: 'Match on an Enum',
    description:
      'Write a function that turns a Shape into a description, using match. Every variant must be handled, and match will not compile until they are.',
    starterCode: `enum Shape {
    Circle(f64),
    Rectangle(f64, f64),
    Unit,
}

fn describe(shape: &Shape) -> String {
    // Match on shape. Bind the values inside each variant and use them.
    //   Circle(r)       -> "circle of radius 3"
    //   Rectangle(w, h) -> "rectangle 2 by 5"
    //   Unit            -> "unit"

}

fn main() {
    println!("{}", describe(&Shape::Circle(3.0)));
    println!("{}", describe(&Shape::Rectangle(2.0, 5.0)));
    println!("{}", describe(&Shape::Unit));
}`,
    testCode: ``,
    expectedOutput: 'circle of radius 3\nrectangle 2 by 5\nunit',
    hints: [
      'match shape { Shape::Circle(r) => ..., Shape::Rectangle(w, h) => ..., Shape::Unit => ... }',
      'The names in the pattern bind to what is inside the variant',
      'format!("circle of radius {}", r) builds the string',
      'A match must cover every variant, or the compiler rejects it',
    ],
    points: 20,
    difficulty: 'medium',
  },

  // Error handling
  {
    id: 'errors-03',
    lessonSlug: 'propagating-errors',
    title: 'Propagate With ?',
    description:
      'Use the ? operator to pass an error up to the caller instead of handling it where it happens.',
    starterCode: `fn parse_and_double(text: &str) -> Result<i32, std::num::ParseIntError> {
    // Parse text into an i32 and return double it.
    // Use ? so a parse failure is returned to the caller rather than
    // unwrapped here.

}

fn main() {
    match parse_and_double("21") {
        Ok(n) => println!("ok {}", n),
        Err(_) => println!("bad"),
    }
    match parse_and_double("abc") {
        Ok(n) => println!("ok {}", n),
        Err(_) => println!("bad"),
    }
}`,
    testCode: ``,
    expectedOutput: 'ok 42\nbad',
    hints: [
      'text.parse::<i32>() returns Result<i32, ParseIntError>',
      '? unwraps the Ok and returns early on Err',
      'let n = text.parse::<i32>()?; then Ok(n * 2)',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'errors-04',
    lessonSlug: 'custom-errors',
    title: 'An Error Type of Your Own',
    description:
      'Implement Display and the Error trait for your own error type, so it can be reported like any other error.',
    starterCode: `use std::fmt;

#[derive(Debug)]
enum ValidationError {
    TooShort(usize),
    Empty,
}

// Implement Display so the error can be printed.
//   TooShort(n) -> "too short: 2 characters"
//   Empty       -> "empty"


// Implement std::error::Error. The default methods are enough, so the
// body of the impl block can be empty -- but Display must exist first,
// because Error requires it.


fn validate(name: &str) -> Result<(), ValidationError> {
    if name.is_empty() {
        return Err(ValidationError::Empty);
    }
    if name.len() < 3 {
        return Err(ValidationError::TooShort(name.len()));
    }
    Ok(())
}

fn main() {
    for name in ["", "ab", "ada"] {
        match validate(name) {
            Ok(()) => println!("ok"),
            Err(e) => println!("{}", e),
        }
    }
}`,
    testCode: ``,
    expectedOutput: 'empty\ntoo short: 2 characters\nok',
    hints: [
      'impl fmt::Display for ValidationError { fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result { ... } }',
      'Inside fmt, match on self and use write!(f, "...") for each variant',
      'impl std::error::Error for ValidationError {} with an empty body is enough',
      'Error requires Display, which is why the order matters',
    ],
    points: 30,
    difficulty: 'hard',
  },

  // Generics
  {
    id: 'traits-03',
    lessonSlug: 'generics',
    title: 'Constrain a Generic',
    description:
      'Write a generic function that works for any comparable type, using a trait bound.',
    starterCode: `// largest should return the biggest item in a slice.
// It must work for any type that can be compared, not just i32.
// Constrain T with a trait bound rather than writing the function twice.
fn largest<T>(items: &[T]) -> &T {

}

fn main() {
    println!("{}", largest(&[3, 7, 2]));
    println!("{}", largest(&["pear", "apple", "quince"]));
}`,
    testCode: ``,
    expectedOutput: '7\nquince',
    hints: [
      'PartialOrd is the trait for > and <',
      'Write it as fn largest<T: PartialOrd>(items: &[T]) -> &T',
      'Walk the slice keeping a reference to the biggest seen so far',
      'Returning &T rather than T means the caller keeps ownership',
    ],
    points: 25,
    difficulty: 'medium',
  },

  // Lifetimes
  {
    id: 'lifetimes-01',
    lessonSlug: 'lifetimes',
    title: 'Annotate a Lifetime',
    description:
      'This function does not compile. The signature does not say how the returned reference relates to the arguments, so add the annotation that does.',
    starterCode: `// This fails with E0106: missing lifetime specifier.
// The compiler cannot tell whether the returned reference borrows from
// x or from y, so it will not guess. Say so with a lifetime parameter.
fn longest(x: &str, y: &str) -> &str {
    if x.len() > y.len() { x } else { y }
}

fn main() {
    println!("{}", longest("hello", "hi"));
    println!("{}", longest("a", "bcd"));
}`,
    testCode: ``,
    expectedOutput: 'hello\nbcd',
    hints: [
      "A lifetime parameter is declared like a type parameter: fn longest<'a>(...)",
      "Then use it on the references: x: &'a str, y: &'a str, and the return type",
      'It means the result lives no longer than the shorter of the two inputs',
      'The body does not change at all; only the signature was ever wrong',
    ],
    points: 30,
    difficulty: 'hard',
  },

  // Collections
  {
    id: 'collections-03',
    lessonSlug: 'hashmaps',
    title: 'Count With a HashMap',
    description:
      'Count how many times each word appears, using the entry API rather than checking for the key first.',
    starterCode: `use std::collections::HashMap;

fn main() {
    let words = ["apple", "pear", "apple", "fig", "apple", "pear"];
    let mut counts: HashMap<&str, i32> = HashMap::new();

    // Count each word. The entry API gives you a place to write whether or
    // not the key was already there, in one lookup rather than two.


    let mut keys: Vec<&&str> = counts.keys().collect();
    keys.sort();
    for k in keys {
        println!("{} {}", k, counts[*k]);
    }
}`,
    testCode: ``,
    expectedOutput: 'apple 3\nfig 1\npear 2',
    hints: [
      'for word in words { ... }',
      'counts.entry(word) returns an Entry for that key',
      '.or_insert(0) gives you a &mut i32, inserting 0 first if the key was absent',
      'Dereference it to add: *counts.entry(word).or_insert(0) += 1;',
    ],
    points: 20,
    difficulty: 'medium',
  },

  // Concurrency: this module had no exercises at all.
  {
    id: 'concurrency-01',
    lessonSlug: 'threads',
    title: 'Spawn and Join',
    description:
      'Start a thread, give it work, and collect its result. join returns what the closure returned.',
    starterCode: `use std::thread;

fn main() {
    // Spawn a thread that sums the numbers 1 to 10 and returns the total.
    // move is needed so the closure takes ownership of what it uses.
    let handle =

    // join() waits for the thread and hands back its return value,
    // wrapped in a Result because the thread might have panicked.
    let total =

    println!("{}", total);
}`,
    testCode: ``,
    expectedOutput: '55',
    hints: [
      'thread::spawn(move || { ... }) returns a JoinHandle',
      'The last expression in the closure is what the thread returns',
      '(1..=10).sum::<i32>() adds them up',
      'handle.join().unwrap() waits and unwraps the Result',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'concurrency-02',
    lessonSlug: 'channels',
    title: 'Send Between Threads',
    description:
      'Use a channel to move values out of a thread. The sender is moved into the thread; the receiver stays behind.',
    starterCode: `use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    // Spawn a thread that sends 1, 2 and 3 down the channel.
    // tx must be moved into the closure.


    // Receiving ends when every sender has been dropped. Because tx was
    // moved into the thread, it is dropped when the thread finishes, so
    // this loop terminates on its own.
    for received in rx {
        println!("{}", received);
    }
}`,
    testCode: ``,
    expectedOutput: '1\n2\n3',
    hints: [
      'thread::spawn(move || { ... }) takes ownership of tx',
      'tx.send(i).unwrap() sends one value',
      'Loop over 1..=3 inside the thread',
      'Do not keep a second copy of tx outside, or the receive loop never ends',
    ],
    points: 25,
    difficulty: 'medium',
  },
  {
    id: 'concurrency-03',
    lessonSlug: 'shared-state',
    title: 'Share a Counter',
    description:
      'Four threads increment one counter a thousand times each. Make it total 4000 every time, using the two types Rust gives you for shared mutable state.',
    starterCode: `use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    // Two wrappers, each doing one job:
    //   Mutex<T> makes the value safe to mutate from one thread at a time.
    //   Arc<T> lets several threads own a handle to the same value.
    // Rc will not compile here, because it is not Send.
    let counter =

    let mut handles = vec![];

    for _ in 0..4 {
        // Each thread needs its own handle to the same counter.
        let counter =

        handles.push(thread::spawn(move || {
            for _ in 0..1000 {
                // Lock, increment, and let the guard drop at the end of
                // the iteration so another thread can take its turn.

            }
        }));
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("{}", *counter.lock().unwrap());
}`,
    testCode: ``,
    expectedOutput: '4000',
    hints: [
      'Arc::new(Mutex::new(0)) wraps a zero in both',
      'Arc::clone(&counter) makes another handle; it copies the pointer, not the value',
      'counter.lock().unwrap() returns a guard that dereferences to the value',
      '*counter.lock().unwrap() += 1; does the increment',
      'The lock is released when the guard goes out of scope, with no unlock call',
    ],
    points: 30,
    difficulty: 'hard',
  },
];

export function getChallengesForLesson(lessonSlug: string): CodeChallenge[] {
  return challenges.filter((c) => c.lessonSlug === lessonSlug);
}

export function buildTestableCode(challenge: CodeChallenge): string {
  // If the starter code already contains #[cfg(test)], use it as-is
  if (challenge.starterCode.includes('#[cfg(test)]')) {
    return challenge.starterCode;
  }
  // Otherwise append the test code
  return challenge.starterCode + '\n\n' + challenge.testCode;
}
