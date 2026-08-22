/**
 * Tailored application documents — a resume and cover letter aimed at one
 * specific opening.
 *
 * The whole design is shaped by one rule: generation may **reorder and
 * re-emphasise** facts the user already supplied, and may never introduce new
 * ones. A resume that invents an employer, a date, or a credential is worse
 * than no resume at all, because the user may not notice before sending it.
 */

export type ApplicationDocumentKind = 'resume' | 'cover-letter';

/** Export targets. Both are ZIP+XML containers writable without an office runtime. */
export type ApplicationExportFormat = 'odt' | 'docx';

/** One role, with its highlights re-ordered for this specific posting. */
export interface TailoredResumeRole {
  title: string;
  company?: string;
  dateRange?: string;
  /** Drawn verbatim from the parsed resume, selected and ordered for relevance. */
  highlights: string[];
}

export interface TailoredResume {
  /** A short professional summary written for this posting. */
  summary: string;
  /** Skills the user actually has, ordered by relevance to the posting. */
  skills: string[];
  roles: TailoredResumeRole[];
  certifications: string[];
}

export interface TailoredCoverLetter {
  greeting: string;
  /** Why this role, this company. */
  opening: string;
  /** Two to four paragraphs of evidence. */
  body: string[];
  closing: string;
  signOff: string;
}

/**
 * What the anti-fabrication gate found. Surfaced to the user rather than
 * silently corrected, so they can see what the model tried to claim.
 */
export interface ApplicationEvidenceReport {
  /**
   * Requirements in the posting with no support anywhere in the user's
   * profile. Shown as honest gaps instead of being papered over.
   */
  gaps: string[];
  /**
   * Statements the generator produced that could not be traced back to the
   * user's own material, and were therefore removed.
   */
  removedClaims: string[];
  /** True when nothing had to be removed. */
  clean: boolean;
}

export interface GeneratedApplication {
  leadId: string;
  resume: TailoredResume;
  coverLetter: TailoredCoverLetter;
  evidence: ApplicationEvidenceReport;
  /** Increments each time the pair is regenerated for this lead. */
  version: number;
  /** False when no model was reachable and the deterministic path produced this. */
  modelGenerated: boolean;
  generatedAt: string;
}

export interface GenerateApplicationRequest {
  leadId: string;
}

export interface RegenerateApplicationSectionRequest {
  leadId: string;
  kind: ApplicationDocumentKind;
  /**
   * Which part to redo. For a resume this is a role company or `summary`;
   * for a cover letter, `opening`, `body`, or `closing`.
   */
  section: string;
}

export interface ApplicationExportRequest {
  leadId: string;
  kind: ApplicationDocumentKind;
  format: ApplicationExportFormat;
}
