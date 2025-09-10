# Client Interface

This is the main client-facing application, built with Angular and using Server-Side Rendering (SSR).

## Ports

- **SSR Server:** `4000`
- **Development Server:** `4200`
- **Storybook:** `4400`

## Environment Variables

| Variable   | Description         | Default |
|------------|---------------------|---------|
| `NODE_ENV` | Node.js environment | `production` |
| `PORT`     | SSR server port     | `4000`  |

## Configuration

### API Proxy

The application proxies API requests from `/api` to the gateway service. This is configured in `apps/client-interface/src/server.ts`.

```typescript
app.use('/api', createProxyMiddleware({
  target: 'http://gateway:3000/api', // Change to your API server URL
  changeOrigin: true,
  // pathRewrite: { '^/api': '' }, // Remove /api prefix when forwarding to the target
}))
```

## Running the Application

### Development

To serve the application in development mode, run:

```bash
nx serve client-interface
```

This will start a development server on port `4200`.

### Production (SSR)

The application can be run in production mode with SSR using the following steps:

1.  **Build the application:**

    ```bash
    nx build client-interface
    ```

2.  **Run the server:**

    ```bash
    node dist/apps/client-interface/server/main.js
    ```

    This will start the SSR server on port `4000` by default.

### Storybook

To run Storybook, use the following command:

```bash
nx storybook client-interface
```

This will start Storybook on port `4400`.
