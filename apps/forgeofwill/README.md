# Forge of Will

This is a client-facing application built with Angular and using Server-Side Rendering (SSR).

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

### API and WebSocket Proxy

The application proxies API and WebSocket requests to the gateway service. This is configured in `apps/forgeofwill/src/server.ts`.

- `/api` requests are proxied to `http://gateway:3000/api`
- `/socket.io` and `/chat` requests are proxied to `http://gateway:3300`

## Running the Application

### Development

To serve the application in development mode, run:

```bash
nx serve forgeofwill
```

This will start a development server on port `4200`.

### Production (SSR)

The application can be run in production mode with SSR using the following steps:

1.  **Build the application:**

    ```bash
    nx build forgeofwill
    ```

2.  **Run the server:**

    ```bash
    node dist/apps/forgeofwill/server/main.js
    ```

    This will start the SSR server on port `4000` by default.

### Storybook

To run Storybook, use the following command:

```bash
nx storybook forgeofwill
```

This will start Storybook on port `4400`.
