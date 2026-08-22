# net/http Basics

Go's standard library includes everything you need to build web servers. Let's explore the fundamentals.

## Simple HTTP Server

```go
package main

import (
    "fmt"
    "net/http"
)

func hello(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello, World!")
}

func main() {
    http.HandleFunc("/", hello)
    http.ListenAndServe(":8080", nil)
}
```

## Handler Pattern

### HandleFunc

```go
http.HandleFunc("/path", handlerFunction)
```

### Handle (with Handler interface)

```go
type Handler interface {
    ServeHTTP(http.ResponseWriter, *http.Request)
}

http.Handle("/path", &myHandler{})
```

## The Handler Function

```go
func handler(w http.ResponseWriter, r *http.Request) {
    // r.URL.Path - the path being requested
    // r.Method - GET, POST, PUT, DELETE
    // r.Header - request headers
    // r.Body - request body

    // w.Header() - response headers
    // w.Write([]byte) - write response
    // w.WriteHeader(statusCode)
}
```

## Path Parameters

```go
func userHandler(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r) // If using gorilla/mux or chi
    userID := vars["id"]

    fmt.Fprintf(w, "User ID: %s", userID)
}
```

Or manually:

```go
func handler(w http.ResponseWriter, r *http.Request) {
    path := r.URL.Path
    // Parse /users/123 -> userID = "123"
}
```

## Query Parameters

```go
func searchHandler(w http.ResponseWriter, r *http.Request) {
    query := r.URL.Query().Get("q")
    page := r.URL.Query().Get("page")

    fmt.Fprintf(w, "Search: %s, Page: %s", query, page)
}
```

## Request Body

```go
func createHandler(w http.ResponseWriter, r *http.Request) {
    // Read body
    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }

    // Or decode JSON directly
    var req CreateRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, err.Error(), 400)
        return
    }
}
```

## Response Types

### JSON Response

```go
func jsonHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "message": "hello",
    })
}
```

### Error Response

```go
func errorHandler(w http.ResponseWriter, r *http.Request) {
    http.Error(w, "Not Found", 404)
}
```

### Redirect

```go
func redirectHandler(w http.ResponseWriter, r *http.Request) {
    http.Redirect(w, r, "/new-path", http.StatusMovedPermanently)
}
```

## Using DefaultServeMux

The `nil` in `http.ListenAndServe` uses `http.DefaultServeMux`:

```go
// This works:
http.HandleFunc("/", hello)
http.ListenAndServe(":8080", nil)

// This also works:
http.HandleFunc("/", hello)
http.ListenAndServe(":8080", http.DefaultServeMux)
```

## Serving Static Files

```go
// Serve from directory
fs := http.FileServer(http.Dir("./static"))
http.Handle("/static/", http.StripPrefix("/static/", fs))

// Or single file
http.HandleFunc("/favicon.ico", func(w http.ResponseWriter, r *http.Request) {
    http.ServeFile(w, r, "./favicon.ico")
})
```

## Complete Example

```go
package main

import (
    "encoding/json"
    "log"
    "net/http"
)

type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

var users = []User{
    {ID: 1, Name: "Alice"},
    {ID: 2, Name: "Bob"},
}

func main() {
    http.HandleFunc("/users", handleUsers)
    http.HandleFunc("/users/", handleUser)

    log.Println("Server starting on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(users)
}

func handleUser(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    id := r.URL.Path[len("/users/"):]
    json.NewEncoder(w).Encode(map[string]string{
        "id": id,
    })
}
```

## Testing HTTP Handlers

```go
func TestHello(t *testing.T) {
    req := httptest.NewRequest("GET", "/", nil)
    rr := httptest.NewRecorder()

    hello(rr, req)

    if rr.Code != http.StatusOK {
        t.Errorf("expected status 200, got %d", rr.Code)
    }

    if rr.Body.String() != "Hello, World!" {
        t.Errorf("unexpected body: %s", rr.Body.String())
    }
}
```

## Code Playground

Build a simple HTTP server and test it!
