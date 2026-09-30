/**
 * Shared bug-report contracts.
 * Duplicated (not imported) in apps/bug-report to keep the backend light.
 */
export interface BugReportNonceResponse {
  nonce: string;
  expiresAt: string;
}

export interface BugReportPayload {
  nonce: string;
  description: string;
  pageUrl: string;
  userAgent: string;
  browserLogs: string[];
  backendTraceIds: string[];
  /** data:image/jpeg;base64,... (inline per plan decision) */
  screenshotDataUrl: string;
  occurredAt: string;
}

export interface BugReportSubmitResult {
  id: string;
  emailSent: boolean;
  issueUrl: string | null;
}

export const BUG_REPORT_LIMITS = {
  descriptionMax: 5000,
  pageUrlMax: 2000,
  userAgentMax: 1000,
  browserLogsMax: 200,
  browserLogEntryMax: 2000,
  backendTraceIdsMax: 20,
  /** Max dataUrl string length (~2MB chars ≈ 1.5MB binary) */
  screenshotDataUrlMax: 2_000_000,
} as const;
