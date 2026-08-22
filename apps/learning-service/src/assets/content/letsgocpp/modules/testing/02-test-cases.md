# Test Cases & Sections

Catch2's `SECTION` macro allows you to organize a single `TEST_CASE` into multiple independently-run sub-scenarios, each starting from the same initial state.

## `SECTION` — Clean Sub-Scenarios

Each `SECTION` within a `TEST_CASE` is run **independently**. The test case setup code runs fresh for each section.

```cpp
TEST_CASE("vector operations", "[vector]") {
    std::vector<int> v = {1, 2, 3};  // setup — runs before EACH section

    SECTION("push_back adds element") {
        v.push_back(4);
        REQUIRE(v.size() == 4);
        REQUIRE(v.back() == 4);
    }

    SECTION("pop_back removes element") {
        v.pop_back();
        REQUIRE(v.size() == 2);
        REQUIRE(v.back() == 2);
    }

    SECTION("clear empties the vector") {
        v.clear();
        REQUIRE(v.empty());
        REQUIRE(v.size() == 0);
    }
}
```

Each section gets a fresh `v = {1, 2, 3}`, so they don't interfere.

---

## Nested Sections

Sections can be nested to form a hierarchy:

```cpp
TEST_CASE("BankAccount", "[bank]") {
    BankAccount account(100.0);  // start with $100

    SECTION("deposit") {
        account.deposit(50.0);
        REQUIRE(account.balance() == 150.0);

        SECTION("then withdraw") {
            account.withdraw(30.0);
            REQUIRE(account.balance() == 120.0);
        }
    }

    SECTION("withdraw") {
        REQUIRE(account.withdraw(40.0));
        REQUIRE(account.balance() == 60.0);

        SECTION("overdraft fails") {
            REQUIRE_FALSE(account.withdraw(100.0));
            REQUIRE(account.balance() == 60.0);  // unchanged
        }
    }
}
```

---

## `GIVEN` / `WHEN` / `THEN` — BDD Style

Catch2 supports Behavior-Driven Development (BDD) style as aliases for `SECTION`:

```cpp
SCENARIO("sorting a vector", "[sort]") {
    GIVEN("an unsorted vector") {
        std::vector<int> v = {5, 2, 8, 1, 9};

        WHEN("we sort it ascending") {
            std::sort(v.begin(), v.end());

            THEN("elements are in order") {
                REQUIRE(v == std::vector<int>{1, 2, 5, 8, 9});
            }
        }

        WHEN("we sort it descending") {
            std::sort(v.begin(), v.end(), std::greater<int>());

            THEN("elements are in reverse order") {
                REQUIRE(v == std::vector<int>{9, 8, 5, 2, 1});
            }
        }
    }
}
```

---

## Test Fixtures

For complex setup shared across many test cases, use a struct-based fixture:

```cpp
struct DatabaseFixture {
    Database db;
    DatabaseFixture() {
        db.connect("test_db");
        db.execute("INSERT INTO users VALUES (1, 'Alice')");
    }
    ~DatabaseFixture() {
        db.execute("DELETE FROM users");
        db.disconnect();
    }
};

TEST_CASE_METHOD(DatabaseFixture, "find user by id", "[db]") {
    auto user = db.findUser(1);
    REQUIRE(user.name == "Alice");
}

TEST_CASE_METHOD(DatabaseFixture, "user count", "[db]") {
    REQUIRE(db.userCount() == 1);
}
```

---

## Running Selected Tests

```bash
./test "BankAccount"        # by test case name
./test "[bank]"             # by tag
./test -v                   # verbose: show all assertions
./test --reporter console   # default output
./test --reporter compact   # compact one-line-per-test
./test --reporter junit     # JUnit XML for CI
```

---

## Key Takeaways

1. `SECTION` runs independently — each gets fresh setup code
2. Nested sections model a **tree of scenarios**
3. `GIVEN/WHEN/THEN` (BDD) is just syntactic sugar for `SCENARIO/SECTION`
4. Use struct-based fixtures with `TEST_CASE_METHOD` for shared state
5. Each section produces a clear test path in the output

---

## Next Steps

- **Assertions & Matchers** — powerful matching for collections, exceptions, and more
