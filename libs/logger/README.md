# logger

This project contains the `logger` library, which provides logging utilities.

## Nx Targets

Here are the available Nx targets for the `logger` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint logger
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test logger
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test logger --configuration=ci
        ```