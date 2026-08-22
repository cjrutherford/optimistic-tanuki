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
