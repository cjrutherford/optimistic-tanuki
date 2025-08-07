# assets-e2e

This project contains the end-to-end tests for the `assets` microservice.

## Nx Targets

Here are the available Nx targets for the `assets-e2e` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint assets-e2e
    ```
-   **e2e**: Runs end-to-end tests using Jest.
    ```bash
    npx nx e2e assets-e2e
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx e2e assets-e2e --configuration=ci
        ```
