# form-ui

This project contains the `form-ui` library, which provides UI components for forms.

## Nx Targets

Here are the available Nx targets for the `form-ui` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint form-ui
    ```
-   **build:storybook**: Builds the Storybook for the project.
    ```bash
    npx nx build:storybook form-ui
    ```
-   **serve:storybook**: Serves the Storybook for the project.
    ```bash
    npx nx serve:storybook form-ui
    ```
-   **test:storybook**: Tests the Storybook for the project.
    ```bash
    npx nx test:storybook form-ui
    ```
-   **static-storybook**: Serves the static Storybook build.
    ```bash
    npx nx static-storybook form-ui
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test form-ui
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test form-ui --configuration=ci
        ```
-   **storybook**: Starts the Storybook development server.
    ```bash
    npx nx storybook form-ui
    ```
-   **build-storybook**: Builds the Storybook for deployment.
    ```bash
    npx nx build-storybook form-ui
    ```
-   **test-storybook**: Runs tests against the Storybook.
    ```bash
    npx nx test-storybook form-ui
    ```