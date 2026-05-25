# business-public-ui Export Map

```mermaid
flowchart TD
  Index[src/index.ts]
  Landing[BusinessLandingPageComponent]
  Booking[BusinessBookingPageComponent]
  Rich[BusinessRichContentRendererComponent]

  Index --> Landing
  Index --> Booking
  Landing -. internal .-> Rich
```
