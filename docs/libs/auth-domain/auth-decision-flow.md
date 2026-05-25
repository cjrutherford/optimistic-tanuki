# auth-domain Auth Decision Flow

```mermaid
flowchart TD
  Register[Registration input]
  Password[PasswordPolicyService]
  Login[Login input]
  MFA[MfaService]
  Token[TokenIssuerService]
  Output[Issued token payload]

  Register --> Password
  Login --> Password
  Login --> MFA
  Password --> Token
  MFA --> Token
  Token --> Output
```
