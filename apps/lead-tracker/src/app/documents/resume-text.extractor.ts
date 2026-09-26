import {
  extractDocumentText,
  normalizeExtractedText,
  DocumentExtractionError,
} from '@optimistic-tanuki/document-text';

/** Why a resume file could not be read, in terms worth showing a user. */
export type ResumeExtractionFailureReason =
  | 'password-protected'
  | 'no-selectable-text'
  | 'corrupt'
  | 'unsupported-format';

export class ResumeExtractionError extends Error {
  constructor(readonly reason: ResumeExtractionFailureReason, message: string) {
    super(message);
    this.name = 'ResumeExtractionError';
  }
}

export interface ResumeExtractionInput {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export { normalizeExtractedText };

export const extractResumeText = async (
  input: ResumeExtractionInput
): Promise<string> => {
  try {
    return await extractDocumentText(input);
  } catch (error) {
    if (error instanceof DocumentExtractionError) {
      throw new ResumeExtractionError(error.reason, error.message);
    }
    throw error;
  }
};
