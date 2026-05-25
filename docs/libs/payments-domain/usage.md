# payments-domain Usage

Use this library when the payments backend needs:

- checkout session creation
- provider-specific webhook normalization
- store catalog lookup by app scope

The current concrete implementation is `LemonSqueezyAdapter`, but the API shape is intended to support additional providers.
