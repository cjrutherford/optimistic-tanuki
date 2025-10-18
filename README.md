# Optimistic Tanuki

This monorepo contains the source code for the Optimistic Tanuki project, a collection of microservices and frontend applications that power a personal digital homestead, a project management tool, and a blogging platform.

## 🚀 Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Node.js](https://nodejs.org/en/download/) (v18 or higher)
- [pnpm](https://pnpm.io/installation)

### Installation

1.  Clone the repo
    ```sh
    git clone https://github.com/cjrutherford/optimistic-tanuki.git
    ```
2.  Install NPM packages
    ```sh
    pnpm install
    ```

## 🛠️ Development

To run the applications in a development environment, you can use the `start-local.sh` script. This will start all the services and frontend applications in development mode.

```sh
./start-local.sh
```

This will start the following services:

- `postgres`: PostgreSQL database
- `db-setup`: Database setup and migration service
- `authentication`: Authentication service (port 3001)
- `client-interface`: Main frontend application (port 4200)
- `gateway`: API gateway (port 3333)
- `profile`: Profile service (port 3002)
- `social`: Social service (port 3003)
- `chat-collector`: Chat collector service (port 3007)
- `assets`: Assets service (port 3005)
- `forgeofwill`: Forge of Will frontend application (port 4201)
- `project-planning`: Project planning service (port 3006)

## 🚢 Deployment

The applications are deployed using Docker. There are two main application stacks that can be run using Docker Compose.

### Standard Stack

This stack runs the main application, including the `client-interface` frontend.

To start the standard stack, run the following command:

```bash
docker-compose up -d
```

### Forge of Will Stack

This stack runs the "Forge of Will" application, which includes the `forgeofwill` frontend and the `project-planning` service.

To start the Forge of Will stack, run the following command:

```bash
docker-compose -f fow.docker-compose.yaml up -d
```

## ✨ Built With

- [Angular](https://angular.io/) - Frontend framework
- [NestJS](https://nestjs.com/) - Backend framework
- [Nx](https://nx.dev/) - Monorepo management tool
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Docker](https://www.docker.com/) - Containerization

## 📂 Project Structure

The workspace is organized into the following directories:

- `apps`: Contains the source code for the individual applications (services and frontends).
- `libs`: Contains shared libraries used by the applications.
- `tools`: Contains scripts and other tools for the workspace.

## 📦 Project Applications

Here's a list of the individual applications within this workspace:

- **`ai-orchestrator`**: A service for orchestrating AI-related tasks.
- **`assets`**: A service for managing digital assets.
- **`authentication`**: A service for user authentication and authorization.
- **`blogging`**: A service for managing blog posts and comments.
- **`chat-collector`**: A service for collecting and storing chat messages.
- **`christopherrutherford-net`**: The frontend for the christopherrutherford.net website.
- **`client-interface`**: The main frontend application for the digital homestead.
- **`digital-homestead`**: A service for managing the digital homestead.
- **`forgeofwill`**: The frontend for the Forge of Will project management tool.
- **`gateway`**: An API gateway that routes requests to the appropriate microservice.
- **`profile`**: A service for managing user profiles.
- **`project-planning`**: A service for managing projects, tasks, and other project-related data.
- **`prompt-proxy`**: A service for proxying requests to prompt-based AI models.
- **`social`**: A service for managing social media integrations.
- **`telos-docs-service`**: A service for managing documentation.

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
