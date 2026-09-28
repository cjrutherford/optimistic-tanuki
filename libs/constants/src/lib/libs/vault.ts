/**
 * TCP Message patterns for Practice Vault, Escrow Wire Shield, and WISP compliance.
 */
export const VAULT_PROCESS_UPLOAD = 'vault.process_upload';
export const VAULT_VERIFY_ESCROW_OTP = 'vault.verify_escrow_otp';
export const VAULT_GET_WISP_AUDIT = 'vault.get_wisp_audit';
export const COPILOT_QUERY_DOCUMENTS = 'copilot.query_documents';

// Owned by the compliance-audit microservice, which is the single source of
// truth for the chained SHA-256 ledger. The gateway appends vault uploads and
// finance appends escrow wire reveals through these patterns.
export const VAULT_APPEND_AUDIT_EVENT = 'vault.append_audit_event';
export const VAULT_LIST_AUDIT_EVENTS = 'vault.list_audit_events';
export const VAULT_VERIFY_AUDIT_CHAIN = 'vault.verify_audit_chain';
export const VAULT_EXPORT_WISP_AUDIT = 'vault.export_wisp_audit';

// Magic-link token lifecycle. Finance owns issuance and the durable
// single-use/revocation registry; the gateway verifies and consumes through
// these patterns so one token cannot be redeemed twice across replicas.
export const VAULT_ISSUE_TOKEN = 'vault.issue_token';
export const VAULT_VALIDATE_TOKEN = 'vault.validate_token';
export const VAULT_CONSUME_TOKEN = 'vault.consume_token';
export const VAULT_REVOKE_TOKEN = 'vault.revoke_token';

// Escrow enrollment and wire-OTP delivery. Registration returns the
// authenticator enrollment exactly once; the SMS path delivers one-time
// codes through the configured Twilio account.
export const VAULT_REGISTER_ESCROW = 'vault.register_escrow';
export const VAULT_REQUEST_WIRE_SMS_OTP = 'vault.request_wire_sms_otp';
export const VAULT_VERIFY_TWILIO_PROVIDER = 'vault.verify_twilio_provider';

// Document text, and the reads the vault MCP tools make against it. The writes
// and the reads are the same table and the same tenant, so a caller cannot reach
// content the audit ledger has not already sealed.
export const VAULT_INGEST_DOCUMENT = 'vault.ingest_document';
export const VAULT_SEARCH_DOCUMENTS = 'vault.search_documents';
export const VAULT_PARSE_TRANSCRIPT = 'vault.parse_transcript';
export const VAULT_PARSE_TAX_SCHEDULE = 'vault.parse_tax_schedule';
