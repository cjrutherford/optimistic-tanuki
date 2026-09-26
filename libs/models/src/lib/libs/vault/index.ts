import {
  IsString,
  IsNumber,
  IsInt,
  IsObject,
  Matches,
  Max,
  Min,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';

export const MAX_AUDIT_EVENTS_PAGE_SIZE = 500;
export const MAX_AUDIT_EXPORT_RECORDS = 10_000;

/**
 * Canonical standard string recorded on every chained audit row and reported
 * at the top of the WISP compliance report.
 */
export const WISP_COMPLIANCE_STANDARD =
  'FTC Safeguards Rule 16 CFR Part 314, IRS Pub 4557';

/**
 * Wire shape accepted by the compliance-audit append handler. `tenantId` is
 * resolved from trusted context by the caller, never from client form data.
 */
export type ComplianceAuditAppendInput = {
  tenantId: string;
  action: string;
  documentHash: string;
  documentId?: string;
  fileName?: string;
  antivirusStatus?: string;
  complianceStandard?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Ledger row as it crosses the TCP boundary. The chain fields are reported
 * back so a caller can prove continuity, never accepted from the caller.
 */
export type ComplianceAuditLogRecord = {
  id: string;
  tenantId: string;
  action: string;
  documentId: string | null;
  fileName: string | null;
  documentHash: string;
  previousHash: string;
  chainedHash: string;
  antivirusStatus: string;
  complianceStandard: string;
  metadata: Record<string, unknown> | null;
  timestamp: string;
};

export type ComplianceAuditExportFormat = 'csv' | 'json';

export type ComplianceAuditExportReport = {
  format: ComplianceAuditExportFormat;
  tenantId: string;
  generatedAt: string;
  totalRecords: number;
  exportedRecords: number;
  maxRecords: number;
  truncated: boolean;
  chainValid: boolean;
  exportedChainValid: boolean;
  fullChainValid: boolean;
  firstBrokenIndex: number | null;
  exportedFirstBrokenIndex: number | null;
  records: ComplianceAuditLogRecord[];
};

export type ComplianceAuditExport = ComplianceAuditExportReport & {
  contentType: string;
  filename: string;
  content: string;
};

export const VAULT_TOKEN_PURPOSES = ['document-drop', 'escrow-wire'] as const;

export type VaultTokenPurpose = (typeof VAULT_TOKEN_PURPOSES)[number];

export type VaultTokenIssueInput = {
  tenantId: string;
  documentId: string;
  purpose: VaultTokenPurpose;
  expiresInSeconds?: number;
  issuedBy?: string;
};

export type VaultTokenIssueResult = {
  token: string;
  jti: string;
  tenantId: string;
  documentId: string;
  purpose: VaultTokenPurpose;
  expiresAt: string;
};

export type VaultTokenCheckInput = {
  token: string;
  purpose?: VaultTokenPurpose;
  expectedTenantId?: string;
  expectedDocumentId?: string;
};

export type VaultTokenClaims = {
  tenantId: string;
  documentId: string;
  purpose: VaultTokenPurpose;
  jti: string;
  iat: number;
  exp: number;
};

export type RegisterEscrowInput = {
  token: string;
  tenantId: string;
  beneficiary: string;
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  reference: string;
};

export type EscrowEnrollmentResult = {
  token: string;
  enrollmentUri: string;
  enrollmentExpiresAt: string;
};

export type WireSmsOtpRequest = {
  token: string;
  tenantId: string;
  phoneNumber: string;
  validitySeconds?: number;
};

export type WireSmsOtpResult = {
  expiresAt: string;
  messageId: string;
};

export type TwilioProviderStatus = {
  configured: boolean;
  verified: boolean;
  accountSid: string | null;
};

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsNumber()
  fileSizeBytes: number;

  @IsString()
  mimeType: string;

  @IsOptional()
  @IsString()
  fileBase64?: string;

  @IsOptional()
  @IsString()
  retentionPolicy?: string;

  @IsOptional()
  @IsString()
  classification?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class DocumentAuditResponseDto {
  @IsString()
  id: string;

  @IsString()
  tenantId: string;

  @IsString()
  documentId: string;

  @IsString()
  fileName: string;

  @IsString()
  documentHash: string;

  @IsString()
  previousHash: string;

  @IsString()
  chainedHash: string;

  @IsString()
  antivirusStatus: 'clean' | 'infected' | 'skipped';

  @IsString()
  complianceStandard: string;

  @IsBoolean()
  wispCompliant: boolean;

  timestamp: Date | string;
  scannedAt: Date | string;
}

export class WireVerificationRequestDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  otpCode: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class WireInstructionResponseDto {
  @IsString()
  escrowId: string;

  @IsString()
  beneficiary: string;

  @IsString()
  bankName: string;

  @IsString()
  routingNumber: string;

  @IsString()
  accountNumber: string;

  @IsString()
  reference: string;

  @IsString()
  complianceNotice: string;

  verifiedAt: Date | string;
  expiresAt: Date | string;
}

export class CopilotQueryDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentIds?: string[];

  @IsOptional()
  @IsString()
  model?: string;
}

export class CopilotSourceExcerptDto {
  @IsString()
  documentId: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsString()
  excerpt: string;
}

/**
 * Document classes the vault knows how to read. A document that is not one of
 * these is still retrievable as text; it simply has no structured parse.
 */
export const VAULT_DOCUMENT_KINDS = [
  'transcript',
  'tax_schedule',
  'other',
] as const;

export type VaultDocumentKind = (typeof VAULT_DOCUMENT_KINDS)[number];

/**
 * One retrieved passage from one tenant-owned document.
 *
 * `offset`/`length` are carried so a citation can be checked against the
 * source rather than taken on trust, and `page` is present when the source
 * carried pagination.
 */
export type VaultDocumentExcerpt = {
  documentId: string;
  fileName: string;
  kind: VaultDocumentKind;
  page: number | null;
  offset: number;
  length: number;
  text: string;
};

/**
 * The retrieval result a tool hands back. `unavailableDocumentIds` is
 * deliberately indistinguishable between "no such document" and "not yours":
 * reporting the difference would turn the tool into a probe for what other
 * tenants hold.
 */
export type VaultDocumentSearchResult = {
  tenantId: string;
  requestedDocumentIds: string[];
  retrievedDocumentIds: string[];
  unavailableDocumentIds: string[];
  excerpts: VaultDocumentExcerpt[];
};

export type TranscriptTurnRole =
  | 'question'
  | 'answer'
  | 'counsel'
  | 'the-witness'
  | 'the-court'
  | 'the-clerk'
  | 'statement';

export type TranscriptTurn = {
  page: number;
  line: number | null;
  speaker: string;
  role: TranscriptTurnRole;
  text: string;
};

export type TranscriptExhibit = {
  number: number;
  marker: string;
};

export type TranscriptAppearance = {
  party: string;
  counsel: string;
};

/**
 * A transcript read deterministically, with no model in the loop. Every field
 * is either read off the page or null; nothing is inferred to fill a gap.
 */
export type ParsedTranscript = {
  documentId: string;
  caseCaption: string | null;
  caseNumber: string | null;
  date: string | null;
  volume: string | null;
  reporter: string | null;
  certificationNumber: string | null;
  appearances: TranscriptAppearance[];
  turns: TranscriptTurn[];
  exhibits: TranscriptExhibit[];
  pageCount: number;
  turnCount: number;
  exhibitCount: number;
};

export type TaxScheduleLineItem = {
  partNumber: number | null;
  partLabel: string | null;
  /**
   * The line reference exactly as the form prints it. Form 1040 uses suffixed
   * lines such as `1a` and `1b`, and a citation that rounds those to a number
   * points a reviewer at the wrong line.
   */
  lineRef: string;
  line: number;
  label: string;
  amount: number;
};

export type TaxScheduleUnparsedLine = {
  lineRef: string;
  text: string;
};

/**
 * The amounts a schedule actually prints. Absent means the line was not on the
 * page; it never means zero.
 */
export type TaxScheduleReportedTotals = {
  grossIncome: number | null;
  totalExpenses: number | null;
  netProfit: number | null;
};

/**
 * A tax schedule read deterministically, with no model in the loop.
 *
 * `reconciliation` compares the printed net profit against printed gross
 * income less printed expenses. `consistent` is null when the page does not
 * carry enough for the comparison, which is a different answer from "it does
 * not add up".
 */
export type ParsedTaxSchedule = {
  documentId: string;
  form: string | null;
  taxYear: number | null;
  filerName: string | null;
  lineItems: TaxScheduleLineItem[];
  unparsedLines: TaxScheduleUnparsedLine[];
  reportedTotals: TaxScheduleReportedTotals;
  reconciliation: {
    consistent: boolean | null;
    reportedNetProfit: number | null;
    computedNetProfit: number | null;
    difference: number | null;
  };
};

export class CopilotResponseDto {
  @IsString()
  answer: string;

  @IsString()
  model: string;

  @IsArray()
  sources: CopilotSourceExcerptDto[];

  @IsBoolean()
  airGapped: boolean;

  timestamp: Date | string;
}

export class WispAuditLogDto {
  @IsArray()
  records: DocumentAuditResponseDto[];

  @IsBoolean()
  chainValid: boolean;

  @IsNumber()
  totalRecords: number;

  @IsString()
  complianceStandard: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  generatedAt: Date | string;
}

/**
 * Append body for the compliance-audit ledger. `tenantId` is carried alongside
 * the body by the caller (it is trusted context, never client-supplied form
 * data), and the chain fields are deliberately absent: the ledger computes
 * `previousHash` and `chainedHash` server-side and rejects any payload that
 * tries to set them.
 */
export class AppendAuditEventDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  action: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-f0-9]{64}$/i)
  documentHash: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  antivirusStatus?: string;

  @IsOptional()
  @IsString()
  complianceStandard?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListAuditEventsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_AUDIT_EVENTS_PAGE_SIZE)
  limit?: number;
}

export class AuditEventPageDto {
  @IsArray()
  records: DocumentAuditResponseDto[];

  @IsString()
  tenantId: string;

  @IsNumber()
  page: number;

  @IsNumber()
  limit: number;

  @IsNumber()
  totalRecords: number;

  @IsBoolean()
  chainValid: boolean;

  @IsString()
  complianceStandard: string;

  generatedAt: Date | string;
}

export class AuditChainVerificationDto {
  @IsString()
  tenantId: string;

  @IsBoolean()
  valid: boolean;

  @IsNumber()
  totalRecords: number;

  @IsString()
  lastHash: string;

  /**
   * Zero-based position of the first record that breaks the chain, or null
   * when the chain verified end to end.
   */
  firstBrokenIndex: number | null;
}
