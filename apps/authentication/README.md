# authentication

This project contains the `authentication` microservice.

## Nx Targets

Here are the available Nx targets for the `authentication` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint authentication
    ```
-   **container**: Builds and optionally pushes a Docker image for the service.
    -   **Default**: Builds a Docker image and loads it into the Docker daemon.
        ```bash
        npx nx container authentication
        ```
    -   **ci**: Builds and pushes a Docker image, suitable for CI environments.
        ```bash
        npx nx container authentication --configuration=ci
        ```
-   **build**: Compiles the application for production.
    -   **Default**: Builds the application for production.
        ```bash
        npx nx build authentication
        ```
    -   **development**: Builds the application for development.
        ```bash
        npx nx build authentication --configuration=development
        ```
-   **serve**: Serves the application in development mode.
    -   **Default**: Serves the application in development mode.
        ```bash
        npx nx serve authentication
        ```
    -   **development**: Serves the application in development mode.
        ```bash
        npx nx serve authentication --configuration=development
        ```
    -   **production**: Serves the application in production mode.
        ```bash
        npx nx serve authentication --configuration=production
        ```
-   **preview**: Starts a Webpack dev server in production mode.
    ```bash
    npx nx preview authentication
    ```
-   **serve-static**: Serves static files from the build output.
    ```bash
    npx nx serve-static authentication
    ```
-   **build-deps**: Builds dependencies.
    ```bash
    npx nx build-deps authentication
    ```
-   **watch-deps**: Watches dependencies and rebuilds on changes.
    ```bash
    npx nx watch-deps authentication
    ```
-   **add-pg-dependency**: Adds PostgreSQL dependency.
    ```bash
    npx nx add-pg-dependency authentication
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test authentication
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test authentication --configuration=ci
        ```
-   **typeorm:migration:generate**: Generates a new TypeORM migration.
    ```bash
    npx nx typeorm:migration:generate authentication --name=<migration-name>
    ```
-   **typeorm:migration:run**: Runs pending TypeORM migrations.
    ```bash
    npx nx typeorm:migration:run authentication
    ```
-   **typeorm:migration:revert**: Reverts the last TypeORM migration.
    ```bash
    npx nx typeorm:migration:revert authentication
    ```
