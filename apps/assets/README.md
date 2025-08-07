# assets

This project contains the `assets` microservice.

## Nx Targets

Here are the available Nx targets for the `assets` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint assets
    ```
-   **container**: Builds and optionally pushes a Docker image for the service.
    -   **Default**: Builds a Docker image and loads it into the Docker daemon.
        ```bash
        npx nx container assets
        ```
    -   **ci**: Builds and pushes a Docker image, suitable for CI environments.
        ```bash
        npx nx container assets --configuration=ci
        ```
-   **build**: Compiles the application for production.
    -   **Default**: Builds the application for production.
        ```bash
        npx nx build assets
        ```
    -   **development**: Builds the application for development.
        ```bash
        npx nx build assets --configuration=development
        ```
-   **serve**: Serves the application in development mode.
    -   **Default**: Serves the application in development mode.
        ```bash
        npx nx serve assets
        ```
    -   **development**: Serves the application in development mode.
        ```bash
        npx nx serve assets --configuration=development
        ```
    -   **production**: Serves the application in production mode.
        ```bash
        npx nx serve assets --configuration=production
        ```
-   **preview**: Starts a Webpack dev server in production mode.
    ```bash
    npx nx preview assets
    ```
-   **serve-static**: Serves static files from the build output.
    ```bash
    npx nx serve-static assets
    ```
-   **build-deps**: Builds dependencies.
    ```bash
    npx nx build-deps assets
    ```
-   **watch-deps**: Watches dependencies and rebuilds on changes.
    ```bash
    npx nx watch-deps assets
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test assets
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test assets --configuration=ci
        ```
-   **typeorm:migration:generate**: Generates a new TypeORM migration.
    ```bash
    npx nx typeorm:migration:generate assets --name=<migration-name>
    ```
-   **typeorm:migration:run**: Runs pending TypeORM migrations.
    ```bash
    npx nx typeorm:migration:run assets
    ```
-   **typeorm:migration:revert**: Reverts the last TypeORM migration.
    ```bash
    npx nx typeorm:migration:revert assets
    ```
