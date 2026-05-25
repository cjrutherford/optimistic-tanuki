# business-portal-ui Architecture

`business-portal-ui` is a shared Angular UI library for owner and client portal experiences. It packages route-level pages for dashboards, requests, clients, availability, billing, tasks, and site-editor workflows.

## Main Building Blocks

- portal shell
- owner auth and dashboard pages
- client auth and portal pages
- owner management pages
- site-editor page

## Key Responsibilities

- provide route-ready portal page components
- bridge portal UI to `business-data-access`
- integrate site editing with preview and configuration workflows
- support owner and client feature-flag-driven navigation
