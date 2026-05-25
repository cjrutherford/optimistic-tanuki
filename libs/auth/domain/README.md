# auth-domain

`auth-domain` contains server-side authentication domain logic for password validation, MFA checks, and token issuance.

## Documentation

- architecture: [`../../../docs/libs/auth-domain/architecture.md`](../../../docs/libs/auth-domain/architecture.md)
- usage: [`../../../docs/libs/auth-domain/usage.md`](../../../docs/libs/auth-domain/usage.md)
- dependency diagram: [`../../../docs/libs/auth-domain/dependency-diagram.md`](../../../docs/libs/auth-domain/dependency-diagram.md)
- auth decision flow: [`../../../docs/libs/auth-domain/auth-decision-flow.md`](../../../docs/libs/auth-domain/auth-decision-flow.md)

## Public API

- `PasswordPolicyService`
- `MfaService`
- `TokenIssuerService`
- token payload and signer types

## Nx Commands

```bash
pnpm exec nx test auth-domain
pnpm exec nx lint auth-domain
```
