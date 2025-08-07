# profile-ui

This project contains the `profile-ui` library, which provides UI components for user profiles.

## Nx Targets

Here are the available Nx targets for the `profile-ui` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint profile-ui
    ```
-   **build:storybook**: Builds the Storybook for the project.
    ```bash
    npx nx build:storybook profile-ui
    ```
-   **serve:storybook**: Serves the Storybook for the project.
    ```bash
    npx nx serve:storybook profile-ui
    ```
-   **test:storybook**: Tests the Storybook for the project.
    ```bash
    npx nx test:storybook profile-ui
    ```
-   **static-storybook**: Serves the static Storybook build.
    ```bash
    npx nx static-storybook profile-ui
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test profile-ui
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test profile-ui --configuration=ci
        ```
-   **storybook**: Starts the Storybook development server.
    ```bash
    npx nx storybook profile-ui
    ```
-   **build-storybook**: Builds the Storybook for deployment.
    ```bash
    npx nx build-storybook profile-ui
    ```
-   **test-storybook**: Runs tests against the Storybook.
    ```bash
    npx nx test-storybook profile-ui
    ```