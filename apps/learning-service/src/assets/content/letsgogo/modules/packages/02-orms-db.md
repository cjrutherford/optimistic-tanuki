# ORMs and Database

Working with databases in Go - from raw SQL to full ORMs.

## GORM (Most Popular ORM)

```bash
go get gorm.io/gorm
go get gorm.io/driver/sqlite
```

```go
import (
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
)

type User struct {
    ID        uint
    Name      string
    Email     string `gorm:"uniqueIndex"`
    CreatedAt time.Time
    UpdatedAt time.Time
}

func main() {
    db, _ := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})

    // Auto migrate
    db.AutoMigrate(&User{})

    // Create
    user := User{Name: "Alice", Email: "alice@example.com"}
    db.Create(&user)

    // Read
    var user User
    db.First(&user, 1)        // By ID
    db.First(&user, "email = ?", "alice@example.com")

    // Update
    db.Model(&user).Update("name", "Alice Smith")

    // Delete
    db.Delete(&user)
}
```

### Querying

```go
// All users
var users []User
db.Find(&users)

// Where
db.Where("name = ?", "Alice").Find(&users)
db.Where("name LIKE ?", "%li%").Find(&users)

// Order
db.Order("created_at DESC").Find(&users)

// Limit
db.Limit(10).Offset(20).Find(&users)

// Count
var count int64
db.Model(&User{}).Count(&count)
```

### Associations

```go
type Company struct {
    ID   uint
    Name string
}

type User struct {
    ID      uint
    Name    string
    Company Company `gorm:"foreignKey:CompanyID"`
    CompanyID uint
}

// Preload associations
db.Preload("Company").Find(&users)
```

## sqlx (Lightweight)

```bash
go get github.com/jmoiron/sqlx
```

```go
import "github.com/jmoiron/sqlx"

var db *sqlx.DB

type User struct {
    ID   int    `db:"id"`
    Name string `db:"name"`
}

func main() {
    db, _ = sqlx.Connect("sqlite", "test.db")

    // Named queries
    results, err := db.NamedQuery(`SELECT * FROM users WHERE name = :name`,
        map[string]interface{}{"name": "Alice"})

    // Struct scanning
    var user User
    db.Get(&user, "SELECT * FROM users WHERE id = ?", 1)

    // Batch
    var users []User
    db.Select(&users, "SELECT * FROM users")
}
```

## ent (Code Generation)

```bash
go get entgo.io/ent
go install entgo.io/ent/cmd/ent

ent generate ./ent/schema
```

```go
// Define schema
type User struct {
    ent.Schema
}

func (User) Fields() []ent.Field {
    return []ent.Field{
        field.String("name"),
        field.String("email"),
    }
}

// Use generated code
client := ent.NewClient()
user, err := client.User.Create().
    SetName("Alice").
    SetEmail("alice@example.com").
    Save(ctx)
```

## Raw SQL

```go
import "database/sql"

var db *sql.DB

func main() {
    // Query
    rows, err := db.Query("SELECT id, name FROM users")
    defer rows.Close()

    for rows.Next() {
        var id int
        var name string
        rows.Scan(&id, &name)
    }

    // Statement
    stmt, err := db.Prepare("INSERT INTO users (name) VALUES (?)")
    result, err := stmt.Exec("Alice")
    id, _ := result.LastInsertId()
}
```

## Best Practices

1. Use context for cancellation
2. Connection pooling with `SetMaxOpenConns`, `SetMaxIdleConns`
3. Use transactions for multi-step operations
4. Prefer sqlx or GORM for complex queries
5. Use migrations for schema changes

## Code Playground

Try building a simple CRUD app!
