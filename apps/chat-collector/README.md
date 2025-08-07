# chat-collector

This project contains the `chat-collector` microservice.

## Nx Targets

Here are the available Nx targets for the `chat-collector` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint chat-collector
    ```
-   **container**: Builds and optionally pushes a Docker image for the service.
    -   **Default**: Builds a Docker image and loads it into the Docker daemon.
        ```bash
        npx nx container chat-collector
        ```
    -   **ci**: Builds and pushes a Docker image, suitable for CI environments.
        ```bash
        npx nx container chat-collector --configuration=ci
        ```
-   **build**: Compiles the application for production.
    -   **Default**: Builds the application for production.
        ```bash
        npx nx build chat-collector
        ```
    -   **development**: Builds the application for development.
        ```bash
        npx nx build chat-collector --configuration=development
        ```
-   **serve**: Serves the application in development mode.
    -   **Default**: Serves the application in development mode.
        ```bash
        npx nx serve chat-collector
        ```
    -   **development**: Serves the application in development mode.
        ```bash
        npx nx serve chat-collector --configuration=development
        ```
    -   **production**: Serves the application in production mode.
        ```bash
        npx nx serve chat-collector --configuration=production
        ```
-   **preview**: Starts a Webpack dev server in production mode.
    ```bash
    npx nx preview chat-collector
    ```
-   **serve-static**: Serves static files from the build output.
    ```bash
    npx nx serve-static chat-collector
    ```
-   **build-deps**: Builds dependencies.
    ```bash
    npx nx build-deps chat-collector
    ```
-   **watch-deps**: Watches dependencies and rebuilds on changes.
    ```bash
    npx nx watch-deps chat-collector
    ```
