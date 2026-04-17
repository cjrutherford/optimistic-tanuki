# Stack Client

`stack-client` is a Go-based authenticated terminal client for interacting with the platform through the gateway.

The current interface is a Bubble Tea TUI, not a generic CLI explorer.

## Build and Run

```bash
cd tools/stack-client
go build -o stack-client ./cmd/stack-client
./stack-client tui
```

Or:

```bash
cd tools/stack-client
go run ./cmd/stack-client tui
```

## Login Flow

The first screen prompts for:

- gateway base URL
- email
- password
- app scope header sent as `x-ot-appscope`

The default base URL is `http://localhost:3000`.

## Current TUI Actions

The current menu is action-oriented and returns formatted JSON for each request.

Supported actions:

- list app configs
- get app config by domain
- lead stats overview
- list leads
- list lead topics
- list communities
- find community by slug
- donation goal
- transactions
- search classifieds
- get classified by id

## Current Limitations

The current implementation is intentionally narrow:

- TUI mode only
- read-heavy workflows
- results rendered as pretty-printed JSON
- no full CRUD forms yet for every domain
- session persistence package exists in the module, but the primary flow is still in-memory TUI session state

## Testing

```bash
cd tools/stack-client
GOCACHE=/tmp/go-build go test ./...
```
