# business-public-ui Architecture

`business-public-ui` is a shared Angular UI library for public business landing pages and booking flows. It encapsulates the public-facing experience while relying on `business-data-access` for runtime data and auth-aware calls.

## Main Building Blocks

- landing page component
- booking page component
- internal rich-content renderer

## Key Responsibilities

- render configurable landing page sections
- support embedded preview mode in editor-like host contexts
- drive booking and lead-intake flows
- safely render rich content with sanitization and controlled embedded component hydration
