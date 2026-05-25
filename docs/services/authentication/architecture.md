# Authentication Architecture

`authentication` is a Nest TCP microservice responsible for identity, credentials, token issuance, multi-factor authentication, OAuth configuration exposure, and cryptographic key bootstrapping for new users.

## Main Responsibilities

- register users and persist core identity data
- validate logins and issue JWT-backed tokens
- persist and revoke tokens
- manage TOTP setup and validation
- provide sanitized OAuth provider configuration
- generate asymmetric key pairs for users and persist public key metadata

## Runtime Model

- `src/main.ts` starts a Nest microservice using `Transport.TCP`
- `src/app/app.module.ts` wires config, database, logger, email, JWT, MFA, password policy, repositories, and OAuth validation
- `src/app/app.service.ts` contains the main authentication workflows
- `src/app/key.service.ts` handles asymmetric key generation and private-key cache writes

## Data Model Boundaries

The service centers around four entity areas:

- `UserEntity`
- `TokenEntity`
- `KeyDatum`
- `OAuthProviderEntity`

Repositories for those entities are injected through a named TypeORM connection. Password hashing and MFA behavior are delegated to shared domain and encryption libraries instead of being implemented directly in the service.

## Security-Critical Paths

- password confirmation and policy validation during registration and reset
- hashed password verification during login
- JWT issuance through `TokenIssuerService`
- MFA token generation and validation through `MfaService`
- key pair generation through `AsymmetricService`
- email notifications for MFA-related account events

## Important Constraint

Private keys are written to a local cache path by `KeyService`. That behavior deserves explicit operational handling in any environment where pods or containers are ephemeral.
