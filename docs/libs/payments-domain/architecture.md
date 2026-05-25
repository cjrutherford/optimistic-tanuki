# payments-domain Architecture

`payments-domain` contains provider adapter abstractions and the Lemon Squeezy adapter used by the payments backend.

## Main Responsibilities

- define provider adapter contracts
- normalize checkout and webhook interactions
- support app-scope store catalog resolution
- isolate payment-provider specifics from the service layer

## Consumers

- `payments`

The library should be treated as the extension point for additional payment providers.
