# storage

This project contains the `storage` library, which provides utilities for storage (local, S3).

## Nx Targets

Here are the available Nx targets for the `storage` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint storage
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test storage
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test storage --configuration=ci
        ```