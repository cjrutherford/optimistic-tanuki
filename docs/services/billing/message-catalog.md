# Billing Message Catalog

```mermaid
flowchart TD
  Caller[Caller]
  Billing[billing]
  Record[record usage]
  Batch[record batch usage]
  Summary[usage summary]
  Grant[grant usage block]
  Consume[consume usage block]
  Invoice[invoice preview]

  Caller --> Billing
  Billing --> Record
  Billing --> Batch
  Billing --> Summary
  Billing --> Grant
  Billing --> Consume
  Billing --> Invoice
```
