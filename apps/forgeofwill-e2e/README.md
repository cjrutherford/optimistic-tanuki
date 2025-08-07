# forgeofwill-e2e

This project contains the end-to-end tests for the `forgeofwill` application.

## Nx Targets

Here are the available Nx targets for the `forgeofwill-e2e` project:

-   **e2e**: Runs end-to-end tests using Playwright.
    ```bash
    npx nx e2e forgeofwill-e2e
    ```
-   **e2e-ci--src/example.spec.ts**: Runs Playwright tests in `src/example.spec.ts` in CI.
    ```bash
    npx nx e2e-ci--src/example.spec.ts forgeofwill-e2e
    ```
-   **e2e-ci**: Runs Playwright tests in CI.
    ```bash
    npx nx e2e-ci forgeofwill-e2e
    ```
-   **lint**: Runs ESLint on the project.
    ```bash
    npx nx lint forgeofwill-e2e
    ```
