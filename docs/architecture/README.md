# Architecture Overview

This document provides a high-level overview of the Optimistic Tanuki platform architecture.

## System Architecture

Optimistic Tanuki is a microservices-based platform built with:

- **Frontend**: Angular applications
- **Backend**: NestJS microservices
- **Gateway**: API gateway for routing and authentication
- **Database**: PostgreSQL
- **Containerization**: Docker and Docker Compose

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Client Interface │  │  Forge of Will   │                │
│  │   (Port 4200)    │  │   (Port 4201)    │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway (Port 3333)                 │
│  - Request routing                                           │
│  - JWT authentication                                        │
│  - Permission checking                                       │
│  - WebSocket gateway                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓ TCP/Message Patterns
┌─────────────────────────────────────────────────────────────┐
│                       Microservices                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Auth    │ │ Profile  │ │  Social  │ │  Assets  │      │
│  │  :3001   │ │  :3002   │ │  :3003   │ │  :3005   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Project  │ │   Chat   │ │   Blog   │ │ AI Orch. │      │
│  │  :3006   │ │  :3007   │ │          │ │          │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐                                               │
│  │Permissions│                                              │
│  │          │                                               │
│  └──────────┘                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database (Port 5432)             │
└─────────────────────────────────────────────────────────────┘
```

## Core Services

### API Gateway

**Port**: 3333  
**Purpose**: Single entry point for all client requests

**Responsibilities**:

- Route requests to appropriate microservices
- JWT-based authentication
- Permission enforcement
- WebSocket gateway for real-time features
- Request/response transformation

See: [API Documentation](../api/README.md)

### Authentication Service

**Port**: 3001  
**Purpose**: User authentication and authorization

**Responsibilities**:

- User registration and login
- JWT token generation and validation
- Password hashing and verification
- Session management

See: [Authentication README](../../apps/authentication/README.md)

### Profile Service

**Port**: 3002  
**Purpose**: User profile management

**Responsibilities**:

- User profile CRUD operations
- Blog role management
- User information storage
- Profile queries

See: [Profile README](../../apps/profile/README.md), [Blog Permissions](../../apps/profile/BLOG_PERMISSIONS.md)

### Social Service

**Port**: 3003  
**Purpose**: Social interactions and content

**Responsibilities**:

- Posts, comments, and votes
- Follow/unfollow relationships
- Content attachments and links
- Real-time social updates via WebSocket

See: [Social README](../../apps/social/README.md), [WebSocket Implementation](./websocket-implementation.md)

### Assets Service

**Port**: 3005  
**Purpose**: Static asset management

**Responsibilities**:

- File upload and storage
- Image processing
- Asset retrieval
- File metadata management

See: [Assets README](../../apps/assets/README.md)

### Project Planning Service

**Port**: 3006  
**Purpose**: Project management and task tracking

**Responsibilities**:

- Project CRUD operations
- Task management
- Risk tracking
- Timeline management

See: [Project Planning README](../../apps/project-planning/README.md)

### Chat Collector Service

**Port**: 3007  
**Purpose**: Chat message collection and storage

**Responsibilities**:

- Chat message persistence
- Conversation history
- Message retrieval

See: [Chat Collector README](../../apps/chat-collector/README.md)

### Blogging Service

**Purpose**: Blog content management

**Responsibilities**:

- Blog post CRUD operations
- Event management
- Contact form handling
- Comment management

See: [Blogging README](../../apps/blogging/README.md)

### Permissions Service

**Purpose**: Role-based access control (RBAC)

**Responsibilities**:

- Permission definition and management
- Role management
- User role assignments
- Permission checking
- App scope management

See: [Permissions System](./permissions.md), [Permissions Cache](./permissions-cache.md)

### AI Orchestrator Service

**Purpose**: AI task orchestration

**Responsibilities**:

- AI agent coordination
- LangChain/LangGraph integration
- Tool call handling
- Multi-response processing

See: [AI Orchestrator README](../../apps/ai-orchestrator/README.md)

## Key Architectural Patterns

### Microservices Communication

**TCP Message Patterns**: Services communicate using NestJS TCP transport with message patterns.

```typescript
// Service A sends a message
this.client.send({ cmd: 'get_user' }, userId);

// Service B handles the message
@MessagePattern({ cmd: 'get_user' })
async getUser(userId: string) {
  return this.userService.findById(userId);
}
```

### Authentication Flow

1. User logs in via Gateway `/auth/login`
2. Gateway forwards to Authentication service
3. Authentication service validates credentials
4. JWT token generated and returned
5. Client includes token in `Authorization: Bearer <token>` header
6. Gateway validates token on each request
7. User ID extracted and passed to microservices

### Permission Enforcement

1. Gateway receives authenticated request
2. `PermissionsGuard` checks required permissions
3. Permissions service validates user has required roles/permissions
4. Request proceeds if authorized, otherwise 403 Forbidden
5. Optional: Microservice performs additional validation

See: [Permissions System](./permissions.md)

### Real-Time Updates

**WebSocket Gateway** (Port 3301 for Social):

- Clients connect via Socket.IO
- Subscribe to specific resources (posts, users, etc.)
- Services broadcast events through gateway
- Only subscribed clients receive updates

See: [WebSocket Implementation](./websocket-implementation.md), [WebSocket Client](./websocket-client.md)

## Frontend Architecture

### Angular Applications

**Client Interface** (Port 4200):

- Main user-facing application
- Social features
- Profile management
- Content browsing

**Forge of Will** (Port 4201):

- Project management interface
- Task tracking
- Risk management
- Project visualization

### UI Component Libraries

Shared component libraries in `libs/`:

- `common-ui`: Common components (buttons, cards, etc.)
- `theme-ui`: Theme management and design system
- `auth-ui`: Authentication components
- `social-ui`: Social feature components
- `profile-ui`: Profile components
- `project-ui`: Project management components
- `blogging-ui`: Blog components
- `form-ui`: Form components

See: [Theme System](./theme-system.md)

## Data Layer

### Database

**PostgreSQL** with TypeORM for schema management.

**Migration Strategy**:

- Migrations stored in `migrations.json`
- Run via `setup-and-migrate.sh`
- Each service manages its own tables
- Shared database instance

**Key Tables** (by service):

- Authentication: users, sessions
- Profile: profiles
- Social: posts, comments, votes, follows
- Permissions: permissions, roles, role_assignments
- Project Planning: projects, tasks, risks
- Blogging: blog_posts, events, contacts

See: [Database Library](../../libs/database/README.md)

## Security Architecture

### Authentication & Authorization

1. **JWT Tokens**: Stateless authentication
2. **Role-Based Access Control (RBAC)**: Fine-grained permissions
3. **Guard System**: Declarative authorization
4. **App Scopes**: Service-level permission isolation

### Security Best Practices

- Password hashing with bcrypt
- JWT token expiration
- CORS configuration
- Input validation with class-validator
- SQL injection prevention via TypeORM
- XSS protection in frontend

See: [Security Audit](./security-audit.md)

## CI/CD Pipeline

Automated build, test, and deployment pipeline using GitHub Actions.

**Pipeline Stages**:

1. Code checkout
2. Dependency installation
3. Linting
4. Unit tests
5. Build
6. E2E tests
7. Docker image build
8. Container registry push
9. Deployment

See: [CI/CD Pipeline](./cicd-pipeline.md)

## Development Workflow

### Local Development

```bash
# Full Docker development stack
pnpm run docker:dev

# Optional first-time bootstrap with seeds
pnpm run docker:dev:bootstrap

# In a second terminal for hot reload
pnpm run watch:build
```

### Testing

```bash
# Unit tests
nx test <project-name>

# E2E tests
nx e2e <project-name>-e2e

# All tests
nx run-many --target=test --all
```

See: [Development Guide](../development/debugging.md), [Testing Guide](../testing/e2e-testing.md)

## Technology Stack

### Backend

- **Framework**: NestJS
- **Language**: TypeScript
- **ORM**: TypeORM
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: class-validator, class-transformer
- **WebSocket**: Socket.IO
- **AI**: LangChain, LangGraph

### Frontend

- **Framework**: Angular 17+
- **Language**: TypeScript
- **Styling**: SCSS, CSS Variables
- **UI Components**: Custom component library
- **State Management**: RxJS
- **Forms**: Reactive Forms
- **HTTP Client**: Angular HttpClient
- **WebSocket**: Socket.IO Client

### DevOps

- **Monorepo**: Nx
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **CI/CD**: GitHub Actions
- **Testing**: Jest, Playwright
- **Linting**: ESLint, Prettier

## Scalability Considerations

### Current Architecture

- Microservices enable independent scaling
- Stateless services (JWT auth)
- Database connection pooling
- Async message patterns

### Future Improvements

- Load balancing for gateway
- Service replication for high availability
- Database read replicas
- Caching layer (Redis)
- Message queue (RabbitMQ/Kafka)
- Service mesh (Istio)

## Related Documentation

- [Getting Started](../getting-started/README.md)
- [API Documentation](../api/README.md)
- [Development Guide](../development/debugging.md)
- [Testing Guide](../testing/e2e-testing.md)
- [Theme System](./theme-system.md)
- [Permissions System](./permissions.md)
