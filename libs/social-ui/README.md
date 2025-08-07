# social-ui

This project contains the `social-ui` library, which provides UI components for social features.

## Nx Targets

Here are the available Nx targets for the `social-ui` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint social-ui
    ```
-   **build:storybook**: Builds the Storybook for the project.
    ```bash
    npx nx build:storybook social-ui
    ```
-   **serve:storybook**: Serves the Storybook for the project.
    ```bash
    npx nx serve:storybook social-ui
    ```
-   **test:storybook**: Tests the Storybook for the project.
    ```bash
    npx nx test:storybook social-ui
    ```
-   **static-storybook**: Serves the static Storybook build.
    ```bash
    npx nx static-storybook social-ui
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test social-ui
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test social-ui --configuration=ci
        ```
-   **storybook**: Starts the Storybook development server.
    ```bash
    npx nx storybook social-ui
    ```
-   **build-storybook**: Builds the Storybook for deployment.
    ```bash
    npx nx build-storybook social-ui
    ```
-   **test-storybook**: Runs tests against the Storybook.
    ```bash
    npx nx test-storybook social-ui
    ```