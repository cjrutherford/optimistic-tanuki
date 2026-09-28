import {
  extractDocumentText,
  DocumentExtractionError,
} from '@optimistic-tanuki/document-text';

export type VaultTextExtraction = {
  text: string;
  extracted: boolean;
  reason?: string;
};

const MAX_TEXT_BYTES = 4 * 1024 * 1024;

export const extractVaultText = async (
  buffer: Buffer | undefined,
  filename = 'document'
): Promise<VaultTextExtraction> => {
  if (!buffer || buffer.length === 0) {
    return { text: '', extracted: false, reason: 'no_content' };
  }
  if (buffer.length > MAX_TEXT_BYTES) {
    return { text: '', extracted: false, reason: 'too_large' };
  }
  try {
    const text = await extractDocumentText({
      filename,
      mimeType: '',
      buffer,
    });
    return { text, extracted: true };
  } catch (error) {
    if (error instanceof DocumentExtractionError) {
      return { text: '', extracted: false, reason: error.reason };
    }
    return { text: '', extracted: false, reason: 'unreadable' };
  }
};
