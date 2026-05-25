# auth-domain Architecture

`auth-domain` contains reusable authentication domain services shared by the authentication backend.

## Main Responsibilities

- enforce password rules and confirmation checks
- validate MFA setup and login tokens
- issue auth token payloads through a signer abstraction

## Consumers

- `authentication`

The library should stay focused on domain rules, not persistence or transport handling.
