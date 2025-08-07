# forgeofwill

This project contains the `forgeofwill` web application.

## Nx Targets

Here are the available Nx targets for the `forgeofwill` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint forgeofwill
    ```
-   **container**: Builds and optionally pushes a Docker image for the service.
    -   **Default**: Builds a Docker image and loads it into the Docker daemon.
        ```bash
        npx nx container forgeofwill
        ```
    -   **ci**: Builds and pushes a Docker image, suitable for CI environments.
        ```bash
        npx nx container forgeofwill --configuration=ci
        ```
-   **build:storybook**: Builds the Storybook for the project.
    ```bash
    npx nx build:storybook forgeofwill
    ```
-   **serve:storybook**: Serves the Storybook for the project.
    ```bash
    npx nx serve:storybook forgeofwill
    ```
-   **test:storybook**: Tests the Storybook for the project.
    ```bash
    npx nx test:storybook forgeofwill
    ```
-   **static-storybook**: Serves the static Storybook build.
    ```bash
    npx nx static-storybook forgeofwill
    ```
-   **build**: Compiles the application for production.
    -   **Default**: Builds the application for production.
        ```bash
        npx nx build forgeofwill
        ```
    -   **production**: Builds the application for production.
        ```bash
        npx nx build forgeofwill --configuration=production
        ```
    -   **development**: Builds the application for development.
        ```bash
        npx nx build forgeofwill --configuration=development
        ```
-   **serve**: Serves the application in development mode.
    -   **Default**: Serves the application in development mode.
        ```bash
        npx nx serve forgeofwill
        ```
    -   **production**: Serves the application in production mode.
        ```bash
        npx nx serve forgeofwill --configuration=production
        ```
    -   **development**: Serves the application in development mode.
        ```bash
        npx nx serve forgeofwill --configuration=development
        ```
-   **extract-i18n**: Extracts i18n messages from the application.
    ```bash
    npx nx extract-i18n forgeofwill
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test forgeofwill
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test forgeofwill --configuration=ci
        ```
-   **serve-static**: Serves static files from the build output.
    ```bash
    npx nx serve-static forgeofwill
    ```
-   **storybook**: Starts the Storybook development server.
    ```bash
    npx nx storybook forgeofwill
    ```
-   **build-storybook**: Builds the Storybook for deployment.
    ```bash
    npx nx build-storybook forgeofwill
    ```
-   **test-storybook**: Runs tests against the Storybook.
    ```bash
    npx nx test-storybook forgeofwill
    ```
