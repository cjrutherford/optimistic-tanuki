# database

This project contains the `database` library, which provides database-related utilities and entities.

## Nx Targets

Here are the available Nx targets for the `database` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint database
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test database
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test database --configuration=ci
        ```