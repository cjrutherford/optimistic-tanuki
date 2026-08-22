# encoding Packages

Go's encoding packages handle converting data between different formats.

## encoding/json

### Marshal (Encode)

```go
import "encoding/json"

type User struct {
    Name  string `json:"name"`
    Email string `json:"email,omitempty"`
    Age   int    `json:"age"`
}

user := User{Name: "Alice", Email: "alice@example.com", Age: 30}

// To JSON
data, err := json.Marshal(user)

// Pretty print
data, err := json.MarshalIndent(user, "", "  ")
fmt.Println(string(data))
```

Output:

```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "age": 30
}
```

### Unmarshal (Decode)

```go
jsonData := `{"name": "Bob", "age": 25}`

var user User
err := json.Unmarshal([]byte(jsonData), &user)
```

### Streaming

```go
// Encoder (write JSON to stream)
encoder := json.NewEncoder(os.Stdout)
encoder.Encode(struct{ Msg string }{"hello"})

// Decoder (read JSON from stream)
decoder := json.NewDecoder(os.Stdin)
var data map[string]interface{}
decoder.Decode(&data)
```

### Tags

```go
type Struct struct {
    Field     string `json:"field"`           // Normal
    OmitEmpty string `json:"omitempty,omitempty"` // Skip if zero
    Ignore    string `json:"-"`                // Skip entirely
    Rename    string `json:"new_name"`        // Rename in JSON
}
```

## encoding/xml

```go
import "encoding/xml"

type Person struct {
    XMLName xml.Name `xml:"person"`
    Name    string   `xml:"name"`
    Email   string   `xml:"email"`
}

p := Person{Name: "Alice", Email: "alice@example.com"}
data, _ := xml.MarshalIndent(p, "", "  ")
fmt.Println(string(data))
```

Output:

```xml
<person>
  <name>Alice</name>
  <email>alice@example.com</email>
</person>
```

## encoding/csv

```go
import "encoding/csv"

func writeCSV() {
    w := csv.NewWriter(os.Stdout)
    w.Write([]string{"Name", "Age"})
    w.Write([]string{"Alice", "30"})
    w.Write([]string{"Bob", "25"})
    w.Flush()
}

func readCSV() {
    r := csv.NewReader(os.Stdin)
    for {
        record, err := r.Read()
        if err == io.EOF {
            break
        }
        fmt.Println(record)
    }
}
```

## Best Practices

1. Use struct tags for JSON field mapping
2. Use `omitempty` for optional fields
3. Handle errors properly
4. Use `Encoder`/`Decoder` for streams for memory efficiency
5. Use `json.Number` for large integers

## Code Playground

Try encoding and decoding JSON!
