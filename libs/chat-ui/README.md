# chat-ui

This project contains the `chat-ui` library, which provides UI components for chat functionality.

## Nx Targets

Here are the available Nx targets for the `chat-ui` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint chat-ui
    ```
-   **build:storybook**: Builds the Storybook for the project.
    ```bash
    npx nx build:storybook chat-ui
    ```
-   **serve:storybook**: Serves the Storybook for the project.
    ```bash
    npx nx serve:storybook chat-ui
    ```
-   **test:storybook**: Tests the Storybook for the project.
    ```bash
    npx nx test:storybook chat-ui
    ```
-   **static-storybook**: Serves the static Storybook build.
    ```bash
    npx nx static-storybook chat-ui
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test chat-ui
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test chat-ui --configuration=ci
        ```
-   **storybook**: Starts the Storybook development server.
    ```bash
    npx nx storybook chat-ui
    ```
-   **build-storybook**: Builds the Storybook for deployment.
    ```bash
    npx nx build-storybook chat-ui
    ```
-   **test-storybook**: Runs tests against the Storybook.
    ```bash
    npx nx test-storybook chat-ui
    ```