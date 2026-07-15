# Gateway Resilience

The gateway is an HTTP front door that proxies to TCP microservices via
`@nestjs/microservices` `ClientProxy` instances. A single slow or hung
microservice must never be able to hang gateway requests indefinitely. This
document describes how the gateway bounds request time and recovers from
transient upstream failures.

## Request timeouts

Every HTTP request is wrapped by a global interceptor,
`RequestTimeoutInterceptor`
(`src/interceptors/request-timeout.interceptor.ts`), registered as an
`APP_INTERCEPTOR` in `src/app/app.module.ts`. It applies an RxJS `timeout` to
the observable returned by each route handler. If an upstream microservice does
not reply within the window, the pending request is aborted and the client
receives a clean `408 Request Timeout` instead of hanging.

- **Default timeout:** `30000` ms.
- **Override with env:** `GATEWAY_REQUEST_TIMEOUT_MS` (milliseconds). A
  non-positive or non-numeric value disables the default timeout, in which case
  only routes carrying an explicit override are bounded.
- **Scope:** only the HTTP context is guarded. WebSocket gateway handlers
  (`ChatGateway`, `SocialGateway`) and any raw RPC calls are passed through
  untouched, so realtime/streaming flows and long-lived sockets are never cut
  off by this interceptor.

### Timeout error shape

Timeouts surface as a structured JSON body (never an unhandled 500 / stack
trace) and are logged at `warn` with the route and handler:

```json
{
  "statusCode": 408,
  "error": "Request Timeout",
  "message": "Upstream service did not respond within 30000ms",
  "method": "POST",
  "path": "/api/<route>"
}
```

Log line (level `warn`):

```
Gateway request timed out after 30000ms: POST /api/<route> -> <Controller>.<handler>
```

The handler identifier (`<Controller>.<handler>`) is a best-effort pointer to
the upstream target — the interceptor cannot know the exact TCP host/port of the
downstream proxy from within the request context.

## Per-route overrides (escape hatch)

Some routes legitimately take longer than the default (LLM prompt generation,
file upload/download proxying). Decorate the handler (or controller) from
`src/decorators/request-timeout.decorator.ts`:

| Decorator                 | Effect                                               |
| ------------------------- | ---------------------------------------------------- |
| `@LongRunning()`          | Extended timeout, `120000` ms (LLM / heavy compute). |
| `@LongRunning(ms)`        | Extended timeout with a custom millisecond value.    |
| `@RequestTimeout(ms)`     | Arbitrary per-route timeout in milliseconds.         |
| `@RequestTimeout('none')` | Disable the gateway timeout for the route entirely.  |

Routes currently exempted from the default timeout:

| Route                                                                                                                                      | Decorator        | Why                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `WellnessController` `ai/prompt`, `ai/context`, `ai/affirmation`, `ai/mindful-activity`, `ai/gratitude-analysis`, `ai/judgment-reflection` | `@LongRunning()` | Proxy LLM generation via the AI orchestration service.                                                                                   |
| `AssetController` `GET /asset/:id`                                                                                                         | `@LongRunning()` | Binary asset download proxy that writes directly to the response (`@Res`); a mid-stream timeout after headers are sent would be harmful. |
| `LeadsController` `POST onboarding/resume/parse`                                                                                           | `@LongRunning()` | Multipart file upload plus downstream resume parsing.                                                                                    |

## Retry / connection behavior

`@nestjs/microservices` v11 TCP **client** has no request-timeout option, and —
unlike the Redis client — it does **not** consume `retryAttempts` / `retryDelay`
(those fields are absent from `TcpClientOptions` and are never read by
`ClientTCP` at runtime). Adding them would be both a compile error and a
runtime no-op, so the gateway does not set them.

Instead:

- **Transient disconnects self-heal.** The TCP client is lazy: it (re)connects
  on the next `send()` after a socket drop, so a brief upstream restart recovers
  without gateway intervention.
- **Hung / slow services are bounded by the timeout interceptor above**, which
  is the real protection against indefinite hangs.

## What happens when a service is down

- **Disabled by composition:** requests routed to a `DisabledClientProxy`
  fail fast with a `Gateway service "<id>" is disabled` error (see
  `src/app/gateway-service-providers.ts`).
- **Enabled but unreachable:** the `send()` observable errors when the socket
  cannot connect; the owning controller maps it to an HTTP error. If the
  connection instead hangs (accepted but no reply), the request is aborted by
  `RequestTimeoutInterceptor` after the configured timeout and returns `408`.

## Configuration summary

| Variable                     | Default | Purpose                                    |
| ---------------------------- | ------- | ------------------------------------------ |
| `GATEWAY_REQUEST_TIMEOUT_MS` | `30000` | Default per-request upstream timeout (ms). |

Declared in the gateway service environment of both `docker-compose.yaml` and
`docker-compose.dev.yaml`.

## Related Diagrams

- [Request Flow](./request-flow.md)
- [Dependency Diagram](./dependency-diagram.md)
- [Operations](./operations.md)
