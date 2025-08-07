# OptimisticTanuki

This is a monorepo managed by Nx, containing several applications and libraries.

## Current Application State

The project is a work in progress, focusing on a social media platform with chat, profile management, asset management, and project planning features.

### Key Applications:
- **client-interface**: The main web application for the social platform.
- **forgeofwill**: A separate web application, likely for project planning or a specific game/tool.
- **gateway**: The API gateway for all microservices.
- **authentication**: Microservice for user authentication and authorization.
- **profile**: Microservice for managing user profiles.
- **social**: Microservice for social interactions (posts, comments, likes, etc.).
- **assets**: Microservice for managing digital assets.
- **chat-collector**: Microservice for collecting and managing chat messages.
- **project-planning**: Microservice for project management features.

### Key Libraries:
- **auth-ui**: UI components related to authentication.
- **chat-ui**: UI components for chat functionality.
- **common-ui**: Reusable common UI components.
- **constants**: Shared constants across the applications.
- **database**: Database-related utilities and entities.
- **encryption**: Utilities for encryption and hashing.
- **form-ui**: UI components for forms.
- **logger**: Logging utilities.
- **message-ui**: UI components for displaying messages/notifications.
- **models**: Shared data models/DTOs.
- **profile-ui**: UI components for user profiles.
- **project-ui**: UI components for project planning.
- **social-ui**: UI components for social features.
- **storage**: Utilities for storage (local, S3).
- **theme-ui**: UI components and utilities for theming.
- **ui-models**: Shared UI-specific data models.

## Getting Started

To set up and run the application locally, follow these steps:

### Prerequisites

- Node.js (LTS version recommended)
- Docker and Docker Compose
- Nx CLI (install globally: `npm install -g nx`)

### 1. Install Dependencies

Navigate to the root of the project and install the Node.js dependencies:

```bash
npm install
```

### 2. Start Dockerized Services

The project uses Docker Compose to manage its backend services (databases, microservices).

To start all services:

```bash
docker-compose up --build -d
```

This command will build the Docker images and start all the necessary containers in detached mode.

### 3. Run Database Migrations

After the services are up, run the database migrations to set up the database schemas:

```bash
./setup-and-migrate.sh
```

### 4. Start the Applications

You can start individual applications using Nx commands.

#### Starting the main application (client-interface)

To start the main client-interface application:

```bash
npx nx serve client-interface
```

This will typically run the application on `http://localhost:4200`.

#### Starting Forge of Will (fow)

To start the Forge of Will application:

```bash
npx nx serve forgeofwill
```

This will typically run the application on `http://localhost:4201` (or another available port).

### 5. Accessing the Applications

Once the applications are running, you can access them in your web browser:

- **OptimisticTanuki (client-interface)**: `http://localhost:4200`
- **Forge of Will (fow)**: `http://localhost:4201` (check console for exact port if different)

## Running Tasks

Nx provides powerful commands to run various tasks for your projects.

To see all available targets for a specific project (e.g., `client-interface`):

```bash
npx nx show project client-interface
```

You can replace `client-interface` with any other project name (e.g., `forgeofwill`, `authentication`, `chat-collector`) to see its specific targets.

Common tasks include:

- **Building for production**: `npx nx build <project-name>`
- **Running tests**: `npx nx test <project-name>`
- **Linting**: `npx nx lint <project-name>`

## Further Documentation

For more detailed information on specific projects and their configurations, refer to their individual `README.md` files located within their respective project directories (e.g., `apps/client-interface/README.md`).