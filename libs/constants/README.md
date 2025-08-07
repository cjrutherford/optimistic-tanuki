# constants

This project contains the `constants` library, which provides shared constants across the applications.

## Nx Targets

Here are the available Nx targets for the `constants` project:

-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint constants
    ```
-   **test**: Runs unit tests using Jest.
    ```bash
    npx nx test constants
    ```
    -   **ci**: Runs tests in CI mode with code coverage.
        ```bash
        npx nx test constants --configuration=ci
        ```