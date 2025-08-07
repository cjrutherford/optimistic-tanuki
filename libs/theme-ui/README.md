# theme-ui

This project contains the `theme-ui` library, which provides UI components and utilities for theming.

## Nx Targets

Here are the available Nx targets for the `theme-ui` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint theme-ui
    ```
-   **build:storybook**: Builds the Storybook for the project.
    ```bash
    npx nx build:storybook theme-ui
    ```
-   **serve:storybook**: Serves the Storybook for the project.
    ```bash
    npx nx serve:storybook theme-ui
    ```
-   **test:storybook**: Tests the Storybook for the project.
    ```bash
    npx nx test:storybook theme-ui
    ```
-   **static-storybook**: Serves the static Storybook build.
    ```bash
    npx nx static-storybook theme-ui
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test theme-ui
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test theme-ui --configuration=ci
        ```
-   **storybook**: Starts the Storybook development server.
    ```bash
    npx nx storybook theme-ui
    ```
-   **build-storybook**: Builds the Storybook for deployment.
    ```bash
    npx nx build-storybook theme-ui
    ```
-   **test-storybook**: Runs tests against the Storybook.
    ```bash
    npx nx test-storybook theme-ui
    ```