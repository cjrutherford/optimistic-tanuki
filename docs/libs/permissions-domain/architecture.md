# permissions-domain Architecture

`permissions-domain` contains the core policy object model and registry for app-scope authorization defaults.

## Main Responsibilities

- model permissions, roles, assignments, mirrors, and cross-scope mappings
- provide a registry of per-app policy definitions
- support default permission and role lookup by app scope

## Consumers

- `permission-lib`

This library is the policy-definition layer and should remain separate from enforcement or cache implementation details.
