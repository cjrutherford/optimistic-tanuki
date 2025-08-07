# gateway

This project contains the `gateway` microservice.

## Nx Targets

Here are the available Nx targets for the `gateway` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint gateway
    ```
-   **container**: Builds and optionally pushes a Docker image for the service.
    -   **Default**: Builds a Docker image and loads it into the Docker daemon.
        ```bash
        npx nx container gateway
        ```
    -   **ci**: Builds and pushes a Docker image, suitable for CI environments.
        ```bash
        npx nx container gateway --configuration=ci
        ```
-   **build**: Compiles the application for production.
    -   **Default**: Builds the application for production.
        ```bash
        npx nx build gateway
        ```
    -   **development**: Builds the application for development.
        ```bash
        npx nx build gateway --configuration=development
        ```
-   **serve**: Serves the application in development mode.
    -   **Default**: Serves the application in development mode.
        ```bash
    npx nx serve gateway
    ```
    -   **development**: Serves the application in development mode.
        ```bash
        npx nx serve gateway --configuration=development
        ```
    -   **production**: Serves the application in production mode.
        ```bash
        npx nx serve gateway --configuration=production
        ```
-   **preview**: Starts a Webpack dev server in production mode.
    ```bash
    npx nx preview gateway
    ```
-   **serve-static**: Serves static files from the build output.
    ```bash
    npx nx serve-static gateway
    ```
-   **build-deps**: Builds dependencies.
    ```bash
    npx nx build-deps gateway
    ```
-   **watch-deps**: Watches dependencies and rebuilds on changes.
    ```bash
    npx nx watch-deps gateway
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test gateway
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test gateway --configuration=ci
        ```
