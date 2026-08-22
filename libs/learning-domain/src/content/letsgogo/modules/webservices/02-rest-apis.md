# REST APIs

Building REST APIs in Go is straightforward with the standard library, but you'll often use a router for more complex routes.

## Using net/http Directly

```go
type User struct {
    ID    int    `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

var users = []User{
    {ID: 1, Name: "Alice", Email: "alice@example.com"},
    {ID: 2, Name: "Bob", Email: "bob@example.com"},
}

func main() {
    http.HandleFunc("/api/users", handleUsers)
    http.HandleFunc("/api/users/", handleUser)
    log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case http.MethodGet:
        listUsers(w, r)
    case http.MethodPost:
        createUser(w, r)
    default:
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
    }
}

func listUsers(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(users)
}

func createUser(w http.ResponseWriter, r *http.Request) {
    var user User
    if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    user.ID = len(users) + 1
    users = append(users, user)

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(user)
}

func handleUser(w http.ResponseWriter, r *http.Request) {
    id := r.URL.Path[len("/api/users/"):]
    idNum, err := strconv.Atoi(id)
    if err != nil {
        http.Error(w, "Invalid ID", http.StatusBadRequest)
        return
    }

    for _, u := range users {
        if u.ID == idNum {
            if r.Method == http.MethodGet {
                json.NewEncoder(w).Encode(u)
                return
            }
            if r.Method == http.MethodDelete {
                // Delete user
                w.WriteHeader(http.StatusNoContent)
                return
            }
        }
    }

    http.Error(w, "User not found", http.StatusNotFound)
}
```

## Using a Router

Third-party routers are commonly used:

```bash
go get github.com/go-chi/chi/v5
```

```go
import (
    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
)

func main() {
    r := chi.NewRouter()

    // Middleware
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)

    // Routes
    r.Route("/api", func(r chi.Router) {
        r.Mount("/users", userRoutes())
    })

    http.ListenAndServe(":8080", r)
}

func userRoutes() http.Handler {
    r := chi.NewRouter()

    r.Get("/", listUsers)
    r.Post("/", createUser)
    r.Route("/{id}", func(r chi.Router) {
        r.Get("/", getUser)
        r.Put("/", updateUser)
        r.Delete("/", deleteUser)
    })

    return r
}
```

## Request Validation

```go
type CreateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

func createUser(w http.ResponseWriter, r *http.Request) {
    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondError(w, http.StatusBadRequest, err.Error())
        return
    }

    if req.Name == "" || req.Email == "" {
        respondError(w, http.StatusBadRequest, "name and email required")
        return
    }

    // Create user...
}

func respondError(w http.ResponseWriter, code int, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    json.NewEncoder(w).Encode(map[string]string{
        "error": message,
    })
}
```

## Error Handling

```go
type APIError struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
}

func handleError(err error) (int, APIError) {
    switch err {
    case ErrNotFound:
        return http.StatusNotFound, APIError{404, "Not found"}
    case ErrUnauthorized:
        return http.StatusUnauthorized, APIError{401, "Unauthorized"}
    default:
        return http.StatusInternalServerError, APIError{500, "Internal error"}
    }
}
```

## Best Practices

1. **Use consistent JSON responses**
2. **Handle all HTTP methods properly**
3. **Validate input**
4. **Use middleware for cross-cutting concerns**
5. **Return proper status codes**

## Code Playground

Build a simple REST API!
