# profile

This project contains the `profile` microservice.

## Nx Targets

Here are the available Nx targets for the `profile` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint profile
    ```
-   **container**: Builds and optionally pushes a Docker image for the service.
    -   **Default**: Builds a Docker image and loads it into the Docker daemon.
        ```bash
        npx nx container profile
        ```
    -   **ci**: Builds and pushes a Docker image, suitable for CI environments.
        ```bash
        npx nx container profile --configuration=ci
        ```
-   **build**: Compiles the application for production.
    -   **Default**: Builds the application for production.
        ```bash
        npx nx build profile
        ```
    -   **development**: Builds the application for development.
        ```bash
        npx nx build profile --configuration=development
        ```
-   **serve**: Serves the application in development mode.
    -   **Default**: Serves the application in development mode.
        ```bash
        npx nx serve profile
        ```
    -   **development**: Serves the application in development mode.
        ```bash
        npx nx serve profile --configuration=development
        ```
    -   **production**: Serves the application in production mode.
        ```bash
        npx nx serve profile --configuration=production
        ```
-   **preview**: Starts a Webpack dev server in production mode.
    ```bash
    npx nx preview profile
    ```
-   **serve-static**: Serves static files from the build output.
    ```bash
    npx nx serve-static profile
    ```
-   **build-deps**: Builds dependencies.
    ```bash
    npx nx build-deps profile
    ```
-   **watch-deps**: Watches dependencies and rebuilds on changes.
    ```bash
    npx nx watch-deps profile
    ```
-   **add-pg-dependency**: Adds PostgreSQL dependency.
    ```bash
    npx nx add-pg-dependency profile
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test profile
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test profile --configuration=ci
        ```
-   **typeorm:migration:generate**: Generates a new TypeORM migration.
    ```bash
    npx nx typeorm:migration:generate profile --name=<migration-name>
    ```
-   **typeorm:migration:run**: Runs pending TypeORM migrations.
    ```bash
    npx nx typeorm:migration:run profile
    ```
-   **typeorm:migration:revert**: Reverts the last TypeORM migration.
    ```bash
    npx nx typeorm:migration:revert profile
    ```
