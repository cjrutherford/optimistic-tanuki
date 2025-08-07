# models

This project contains the `models` library, which provides shared data models/DTOs.

## Nx Targets

Here are the available Nx targets for the `models` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint models
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test models
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test models --configuration=ci
        ```