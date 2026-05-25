# Gateway Operations

## Local Runbook

Primary commands:

```bash
pnpm exec nx build gateway
pnpm exec nx test gateway
pnpm exec nx serve gateway
```

The full local stack usually runs through:

```bash
pnpm run docker:dev
```

Primary local endpoints:

- HTTP API: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api-docs`
- MCP SSE: `http://localhost:3000/api/mcp/sse`

## Configuration Checklist

Before debugging gateway behavior, verify:

1. `LISTEN_PORT` or config-backed `listenPort`
2. downstream `services.*.host` and `services.*.port` values
3. `JWT_SECRET`
4. `GATEWAY_COMPOSITION_PATH` if routes appear to be missing
5. `APP_REGISTRY_PATH` if registry responses are wrong
6. OAuth environment variables if provider data is incomplete

## Common Failure Modes

### Route exists in code but not at runtime

Likely cause: the required downstream services are disabled by composition.

Checks:

- inspect the composition file referenced by `GATEWAY_COMPOSITION_PATH`
- verify the controller's `requiredServices` in `src/app/app.module.ts`

### Calls fail immediately with a disabled-service error

Likely cause: the route or provider resolved through `DisabledClientProxy`.

Checks:

- verify the service is enabled in composition
- verify its config key in `src/app/gateway-service-providers.ts`

### Downstream service timeouts or connection failures

Likely cause: incorrect host or port override.

Checks:

- verify `<SERVICE>_HOST` and `<SERVICE>_PORT`
- compare with `src/config.ts`

### OAuth config is incomplete in gateway responses

Likely cause: environment variables override placeholders or missing client-interface domain overrides.

Checks:

- verify `GOOGLE_*`, `GITHUB_*`, `MICROSOFT_*`, `FACEBOOK_*`
- verify `CLIENT_INTERFACE_DOMAIN` and `CI_*` overrides

## Related Diagrams

- [Dependency Diagram](./dependency-diagram.md)
- [Request Flow](./request-flow.md)
- [Composition Diagram](./composition-diagram.md)
- [Realtime Flow](./realtime-flow.md)
