# business-public-ui Booking Flow

```mermaid
flowchart TD
  Visitor[Visitor]
  Landing[Landing page]
  Booking[Booking page]
  Auth[Client auth flow]
  API[business-data-access]

  Visitor --> Landing
  Landing --> Booking
  Booking --> Auth
  Booking --> API
```
