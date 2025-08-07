# auth-ui

This project contains the `auth-ui` library, which provides UI components related to authentication.

## Nx Targets

Here are the available Nx targets for the `auth-ui` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint auth-ui
    ```
-   **build:storybook**: Builds the Storybook for the project.
    ```bash
    npx nx build:storybook auth-ui
    ```
-   **serve:storybook**: Serves the Storybook for the project.
    ```bash
    npx nx serve:storybook auth-ui
    ```
-   **test:storybook**: Tests the Storybook for the project.
    ```bash
    npx nx test:storybook auth-ui
    ```
-   **static-storybook**: Serves the static Storybook build.
    ```bash
    npx nx static-storybook auth-ui
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test auth-ui
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test auth-ui --configuration=ci
        ```
-   **storybook**: Starts the Storybook development server.
    ```bash
    npx nx storybook auth-ui
    ```
-   **build-storybook**: Builds the Storybook for deployment.
    ```bash
    npx nx build-storybook auth-ui
    ```
-   **test-storybook**: Runs tests against the Storybook.
    ```bash
    npx nx test-storybook auth-ui
    ```