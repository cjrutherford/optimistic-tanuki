# project-planning-e2e

This project contains the end-to-end tests for the `project-planning` microservice.

## Nx Targets

Here are the available Nx targets for the `project-planning-e2e` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint project-planning-e2e
    ```
-   **e2e**: Runs end-to-end tests using Jest.
    ```bash
    npx nx e2e project-planning-e2e
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx e2e project-planning-e2e --configuration=ci
        ```
