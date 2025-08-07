# project-planning

This project contains the `project-planning` microservice.

## Nx Targets

Here are the available Nx targets for the `project-planning` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint project-planning
    ```
-   **container**: Builds and optionally pushes a Docker image for the service.
    -   **Default**: Builds a Docker image and loads it into the Docker daemon.
        ```bash
        npx nx container project-planning
        ```
    -   **ci**: Builds and pushes a Docker image, suitable for CI environments.
        ```bash
        npx nx container project-planning --configuration=ci
        ```
-   **build**: Compiles the application for production.
    -   **Default**: Builds the application for production.
        ```bash
        npx nx build project-planning
        ```
    -   **development**: Builds the application for development.
        ```bash
        npx nx build project-planning --configuration=development
        ```
-   **serve**: Serves the application in development mode.
    -   **Default**: Serves the application in development mode.
        ```bash
        npx nx serve project-planning
        ```
    -   **development**: Serves the application in development mode.
        ```bash
        npx nx serve project-planning --configuration=development
        ```
    -   **production**: Serves the application in production mode.
        ```bash
        npx nx serve project-planning --configuration=production
        ```
-   **preview**: Starts a Webpack dev server in production mode.
    ```bash
    npx nx preview project-planning
    ```
-   **serve-static**: Serves static files from the build output.
    ```bash
    npx nx serve-static project-planning
    ```
-   **build-deps**: Builds dependencies.
    ```bash
    npx nx build-deps project-planning
    ```
-   **watch-deps**: Watches dependencies and rebuilds on changes.
    ```bash
    npx nx watch-deps project-planning
    ```
-   **typeorm:migration:generate**: Generates a new TypeORM migration.
    ```bash
    npx nx typeorm:migration:generate project-planning --name=<migration-name>
    ```
-   **typeorm:migration:run**: Runs pending TypeORM migrations.
    ```bash
    npx nx typeorm:migration:run project-planning
    ```
-   **typeorm:migration:revert**: Reverts the last TypeORM migration.
    ```bash
    npx nx typeorm:migration:revert project-planning
    ```
