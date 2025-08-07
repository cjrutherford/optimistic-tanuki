# client-interface

This project contains the `client-interface` web application.

## Nx Targets

Here are the available Nx targets for the `client-interface` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint client-interface
    ```
-   **container**: Builds and optionally pushes a Docker image for the service.
    -   **Default**: Builds a Docker image and loads it into the Docker daemon.
        ```bash
        npx nx container client-interface
        ```
    -   **ci**: Builds and pushes a Docker image, suitable for CI environments.
        ```bash
        npx nx container client-interface --configuration=ci
        ```
-   **build:storybook**: Builds the Storybook for the project.
    ```bash
    npx nx build:storybook client-interface
    ```
-   **serve:storybook**: Serves the Storybook for the project.
    ```bash
    npx nx serve:storybook client-interface
    ```
-   **test:storybook**: Tests the Storybook for the project.
    ```bash
    npx nx test:storybook client-interface
    ```
-   **static-storybook**: Serves the static Storybook build.
    ```bash
    npx nx static-storybook client-interface
    ```
-   **build**: Compiles the application for production.
    -   **Default**: Builds the application for production.
        ```bash
        npx nx build client-interface
        ```
    -   **production**: Builds the application for production.
        ```bash
        npx nx build client-interface --configuration=production
        ```
    -   **development**: Builds the application for development.
        ```bash
        npx nx build client-interface --configuration=development
        ```
-   **serve**: Serves the application in development mode.
    -   **Default**: Serves the application in development mode.
        ```bash
        npx nx serve client-interface
        ```
    -   **production**: Serves the application in production mode.
        ```bash
        npx nx serve client-interface --configuration=production
        ```
    -   **development**: Serves the application in development mode.
        ```bash
        npx nx serve client-interface --configuration=development
        ```
-   **extract-i18n**: Extracts i18n messages from the application.
    ```bash
    npx nx extract-i18n client-interface
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test client-interface
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test client-interface --configuration=ci
        ```
-   **serve-static**: Serves static files from the build output.
    ```bash
    npx nx serve-static client-interface
    ```
-   **storybook**: Starts the Storybook development server.
    ```bash
    npx nx storybook client-interface
    ```
-   **build-storybook**: Builds the Storybook for deployment.
    ```bash
    npx nx build-storybook client-interface
    ```
-   **test-storybook**: Runs tests against the Storybook.
    ```bash
    npx nx test-storybook client-interface
    ```
