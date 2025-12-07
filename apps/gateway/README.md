# Gateway

This service is an API gateway that routes requests to the appropriate microservice. It provides a single point of entry for all API requests, and is responsible for tasks such as authentication, rate limiting, and logging.

## 🚀 Getting Started

This service is started as part of the main application stack. See the main [README.md](../../README.md) for instructions on how to start the application.

## 📝 API Reference

The Gateway service exposes a RESTful API for interacting with its features. The API is documented using Swagger, and the documentation can be accessed at `http://localhost:3000/api-docs`.

## 🔌 WebSocket Endpoints

The Gateway service also provides WebSocket support for real-time updates:

### Chat WebSocket
- **Port:** 3300 (configurable via `SOCKET_PORT` environment variable)
- **Namespace:** `/chat`
- **Purpose:** Real-time chat messaging

### Social WebSocket
- **Port:** 3301 (configurable via `SOCIAL_SOCKET_PORT` environment variable)
- **Namespace:** `/social`
- **Purpose:** Real-time social updates (posts, comments, votes, follows)
- **Documentation:** See [Social WebSocket Client Guide](../../docs/SOCIAL_WEBSOCKET_CLIENT.md)

## 🔧 Environment Variables

- `PORT` - HTTP API port (default: 3000)
- `SOCKET_PORT` - Chat WebSocket port (default: 3300)
- `SOCIAL_SOCKET_PORT` - Social WebSocket port (default: 3301)
- `CORS_ORIGIN` - CORS origin configuration for WebSocket connections (default: '*' for development)
