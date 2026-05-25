# auth-domain Usage

Use this library when a server-side consumer needs:

- password validation rules
- TOTP-based MFA checks
- token issuance through an injected signer contract

Callers are expected to provide persistence, config, and transport behavior outside this library.
