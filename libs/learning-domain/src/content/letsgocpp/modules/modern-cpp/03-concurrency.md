# Concurrency

C++11 added built-in concurrency support with `std::thread`, mutexes, and futures.

## `std::thread`

```cpp
#include <thread>
#include <iostream>

void task(int id) {
    std::cout << "Thread " << id << " running\n";
}

int main() {
    std::thread t1(task, 1);
    std::thread t2(task, 2);

    t1.join();  // wait for t1 to finish
    t2.join();  // wait for t2 to finish

    return 0;
}
```

Use lambdas for inline thread work:

```cpp
std::thread t([](){ std::cout << "Lambda thread\n"; });
t.join();
```

---

## Mutexes — Preventing Data Races

```cpp
#include <mutex>

int counter = 0;
std::mutex mtx;

void increment(int times) {
    for (int i = 0; i < times; i++) {
        std::lock_guard<std::mutex> lock(mtx);  // RAII lock
        ++counter;
    }   // lock released automatically
}

std::thread t1(increment, 1000);
std::thread t2(increment, 1000);
t1.join(); t2.join();
std::cout << counter << "\n";  // 2000 — no data race
```

### `std::unique_lock` for more control

```cpp
std::unique_lock<std::mutex> lock(mtx);
// ... critical section ...
lock.unlock();  // can unlock early
// ... non-critical work ...
lock.lock();    // re-lock
```

---

## `std::atomic` — Lock-Free Atomics

For simple shared variables, `std::atomic` provides lock-free thread safety:

```cpp
#include <atomic>

std::atomic<int> counter{0};

void increment(int times) {
    for (int i = 0; i < times; i++) {
        counter++;  // atomic increment — no mutex needed
    }
}
```

---

## Futures and Promises

`std::future` / `std::promise` provide a way to get a value from another thread:

```cpp
#include <future>

int heavyComputation(int n) {
    // expensive work
    return n * n;
}

// Launch asynchronously
std::future<int> result = std::async(std::launch::async, heavyComputation, 42);

// ... do other work while computation runs ...

int value = result.get();  // blocks until computation is done
std::cout << value << "\n";  // 1764
```

---

## `std::async` Launch Policies

```cpp
// Force async execution on a new thread
auto f1 = std::async(std::launch::async, task);

// Allow lazy (deferred) execution on calling thread
auto f2 = std::async(std::launch::deferred, task);

// Let the implementation decide
auto f3 = std::async(task);  // default: async | deferred
```

---

## Condition Variables

For producer-consumer patterns:

```cpp
#include <condition_variable>
#include <queue>

std::mutex mtx;
std::condition_variable cv;
std::queue<int> queue;

void producer() {
    for (int i = 0; i < 10; i++) {
        std::lock_guard<std::mutex> lock(mtx);
        queue.push(i);
        cv.notify_one();
    }
}

void consumer() {
    while (true) {
        std::unique_lock<std::mutex> lock(mtx);
        cv.wait(lock, []{ return !queue.empty(); });
        int val = queue.front(); queue.pop();
        std::cout << "Got: " << val << "\n";
    }
}
```

---

## Key Takeaways

1. `std::thread` creates OS threads — always `join()` or `detach()`
2. **Data races** are undefined behavior — use a mutex or atomic
3. `std::lock_guard` is the simplest RAII mutex wrapper
4. `std::atomic<T>` for simple shared variables (no mutex needed)
5. `std::async` + `std::future` for fire-and-collect async tasks
6. Compile with `-lpthread` on Linux: `g++ -std=c++17 -lpthread main.cpp`

---

## Next Steps

- **Testing** — writing tests for concurrent code is challenging; learn Catch2 first
- **RAII** — revisit how mutexes use RAII patterns
