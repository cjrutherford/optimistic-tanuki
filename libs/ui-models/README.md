# ui-models

This project contains the `ui-models` library, which provides shared UI-specific data models.

## Nx Targets

Here are the available Nx targets for the `ui-models` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint ui-models
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test ui-models
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test ui-models --configuration=ci
        ```