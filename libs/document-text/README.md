# document-text

Shared plain-text extraction from PDF, Word (DOCX), OpenDocument (ODT), and
plain-text buffers. Used by lead ingestion (resumes) and the Practice Vault
confidential copilot (client documents).

Unreadable input fails loudly with a `DocumentExtractionError` carrying a
machine-readable reason (`password-protected`, `no-selectable-text`,
`corrupt`, `unsupported-format`) instead of returning invented or partial
text.
