# social-e2e

This project contains the end-to-end tests for the `social` microservice.

## Nx Targets

Here are the available Nx targets for the `social-e2e` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint social-e2e
    ```
-   **e2e**: Runs end-to-end tests using Jest.
    ```bash
    npx nx e2e social-e2e
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx e2e social-e2e --configuration=ci
        ```
