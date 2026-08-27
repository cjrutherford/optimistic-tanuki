# Hello World

Welcome to C++! Let's write the classic first program every developer writes when learning a new language.

## Your First C++ Program

```cpp
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
```

### Expected Output

```
Hello, World!
```

---

## Deep Dive: Understanding Each Component

### 1. `#include <iostream>`

The `#include` directive tells the **preprocessor** to copy the contents of a header file into your source code before compilation.

`iostream` stands for **Input/Output Stream** and provides:

- `std::cout` – standard output (console)
- `std::cin` – standard input (keyboard)
- `std::cerr` – standard error output

```cpp
#include <iostream>   // standard I/O
#include <string>     // std::string
#include <vector>     // std::vector
#include <algorithm>  // sort, find, etc.
```

**Angle brackets `<>` vs quotes `""`:**

- `<iostream>` – system/standard library headers
- `"myheader.h"` – your own project headers

### 2. `int main()`

Every C++ program has exactly one `main()` function — it's where execution starts.

```cpp
int main() {
    // code here
    return 0;  // 0 means success
}
```

**Return value convention:**

- `return 0` – success
- `return 1` (or any non-zero) – error/failure

You can also accept command-line arguments:

```cpp
int main(int argc, char* argv[]) {
    // argc = argument count
    // argv = array of argument strings
    return 0;
}
```

### 3. `std::cout << "Hello, World!" << std::endl`

`std::cout` is the **standard character output** object. The `<<` operator is the **stream insertion operator** — it sends data into the stream.

```cpp
std::cout << "Hello, World!" << std::endl;
//           ^ string literal    ^ newline + flush
```

**`std::endl` vs `"\n"`:**

|                | `std::endl` | `"\n"` |
| -------------- | ----------- | ------ |
| Adds newline   | ✅          | ✅     |
| Flushes buffer | ✅          | ❌     |
| Performance    | Slower      | Faster |

Prefer `"\n"` for performance unless you need an explicit flush.

```cpp
std::cout << "Line 1\n";
std::cout << "Line 2\n";
```

### 4. `using namespace std;`

You'll often see this in examples to avoid typing `std::` everywhere:

```cpp
using namespace std;
cout << "Hello!" << endl;  // no std:: needed
```

**Best practice:** Avoid `using namespace std;` in header files and large projects. It can cause name collisions. Use it sparingly in small programs or source files.

---

## Compiling Your Program

C++ is a **compiled** language. You must compile source code to an executable before running.

### Method 1: g++ (GCC)

```bash
g++ -o hello main.cpp    # compile
./hello                   # run
```

### Method 2: With C++17 standard

```bash
g++ -std=c++17 -o hello main.cpp
./hello
```

### Method 3: clang++

```bash
clang++ -std=c++17 -o hello main.cpp
./hello
```

### Method 4: CMake (for larger projects)

```cmake
cmake_minimum_required(VERSION 3.10)
project(Hello)
add_executable(hello main.cpp)
```

---

## Multiple Output Statements

```cpp
#include <iostream>

int main() {
    std::cout << "Name: Alice\n";
    std::cout << "Age: " << 30 << "\n";
    std::cout << "Score: " << 98.5 << "\n";
    return 0;
}
```

Output:

```
Name: Alice
Age: 30
Score: 98.5
```

---

## Common Errors

### Error 1: Missing semicolon

```
error: expected ';' after expression
```

Every statement in C++ ends with a semicolon `;`.

### Error 2: Missing `#include`

```
error: 'cout' was not declared in this scope
```

Add `#include <iostream>` at the top.

### Error 3: Missing `main` function

```
error: undefined reference to 'main'
```

Every executable must have a `main()` function.

---

## Key Takeaways

1. `#include <iostream>` brings in standard I/O functionality
2. `int main()` is the program entry point
3. `std::cout <<` outputs to the console
4. Use `"\n"` for newlines (faster than `std::endl`)
5. Compile with `g++ -std=c++17 -o program main.cpp`

---

## Next Steps

- **Variables & Types** – Learn how to store and manipulate data
- **Functions** – Organize code into reusable blocks
- **Challenge:** Write a program that prints your name and favorite programming language!

---

> **Pro Tip:** Always compile with `-Wall -Wextra` to enable extra warnings: `g++ -std=c++17 -Wall -Wextra -o hello main.cpp`
