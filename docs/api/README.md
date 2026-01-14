# API Documentation

This document provides an overview of the APIs exposed by the various services in the Optimistic Tanuki platform.

## API Gateway

All client requests should go through the API Gateway, which routes requests to the appropriate microservices.

**Gateway URL**: `http://localhost:3333` (development)

### Authentication

The gateway uses JWT-based authentication. Include the JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

### Endpoints by Service

The gateway routes requests to microservices based on the endpoint path. Below are the main service prefixes:

## Authentication Service

**Base Path**: `/auth`

Handles user authentication, registration, and session management.

For detailed API documentation, see [Authentication Service README](../apps/authentication/README.md).

## Profile Service

**Base Path**: `/profile`

Manages user profiles and user information.

For detailed API documentation, see [Profile Service README](../apps/profile/README.md).

## Social Service

**Base Path**: `/social`

Manages social interactions including posts, follows, votes, comments, links, and attachments.

For detailed API documentation, see [Social Service README](../apps/social/README.md).

## Assets Service

**Base Path**: `/assets`

Handles storage and retrieval of static assets such as images, documents, and media files.

For detailed API documentation, see [Assets Service README](../apps/assets/README.md).

## Blogging Service

**Base Path**: `/blog`

Manages blog posts, comments, events, and contacts.

For detailed API documentation, see [Blogging Service README](../apps/blogging/README.md).

## Project Planning Service

**Base Path**: `/project`

Manages projects, tasks, risks, and other project-related data.

For detailed API documentation, see [Project Planning Service README](../apps/project-planning/README.md).

## Permissions Service

**Base Path**: `/permissions`

Manages user permissions, roles, and access control.

For detailed API documentation, see [Permissions Service README](../apps/permissions/README.md).

## AI Orchestrator Service

**Base Path**: `/ai`

Orchestrates AI-related tasks and agent interactions.

For detailed API documentation, see [AI Orchestrator README](../apps/ai-orchestrator/README.md).

## Chat Collector Service

**Base Path**: `/chat`

Collects and stores chat messages.

For detailed API documentation, see [Chat Collector README](../apps/chat-collector/README.md).

## Prompt Proxy Service

**Base Path**: `/prompt`

Proxies requests to AI prompt services.

For detailed API documentation, see [Prompt Proxy README](../apps/prompt-proxy/README.md).

## Common Patterns

### Error Responses

All services follow a consistent error response format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

### Pagination

Services that return lists support pagination with query parameters:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

Response format:

```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

### Filtering and Sorting

Many endpoints support filtering and sorting via query parameters. Check individual service documentation for specific parameters.

## WebSocket APIs

Some services support real-time communication via WebSockets.

### Social Service WebSocket

For real-time social updates, see [WebSocket Client Guide](../architecture/websocket-client.md).

## API Versioning

Currently, the API does not use versioning. Breaking changes will be communicated and managed through the release process.

## Rate Limiting

Rate limiting is not currently enforced but may be added in future releases.

## Further Reading

- [Gateway Configuration](../apps/gateway/README.md)
- [Authentication Guide](../architecture/permissions.md)
- [Development API Configuration](../development/api-configuration.md)
