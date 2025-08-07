# encryption

This project contains the `encryption` library, which provides utilities for encryption and hashing.

## Nx Targets

Here are the available Nx targets for the `encryption` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint encryption
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test encryption
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test encryption --configuration=ci
        ```