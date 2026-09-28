import { isZipContainer, readZipEntry, ZipReadError } from './zip-reader';
import PDFParser from 'pdf2json';

/** Why a file could not be read, in terms worth showing a user. */
export type DocumentExtractionFailureReason =
  | 'password-protected'
  | 'no-selectable-text'
  | 'corrupt'
  | 'unsupported-format';

export class DocumentExtractionError extends Error {
  constructor(
    readonly reason: DocumentExtractionFailureReason,
    message: string
  ) {
    super(message);
    this.name = 'DocumentExtractionError';
  }
}

export interface DocumentExtractionInput {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  minUsefulCharacters?: number;
}

const PDF_MAGIC = '%PDF-';

const DEFAULT_MIN_USEFUL_CHARACTERS = 40;

const looksLikePdf = (buffer: Buffer): boolean =>
  buffer.subarray(0, 1024).toString('latin1').includes(PDF_MAGIC);

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&amp;/g, '&');

/**
 * Pulls readable text out of WordprocessingML or ODF content.
 *
 * Both mark paragraphs and line breaks with elements rather than newlines, so
 * those are converted before tags are stripped. Otherwise every bullet and
 * heading runs together into one line and downstream line-based heuristics
 * see a single unusable blob.
 */
const xmlPartToText = (xml: string): string =>
  decodeXmlEntities(
    xml
      .replace(/<\/(w:p|text:p|text:h)>/g, '\n')
      .replace(/<(w:br|w:cr|text:line-break)\b[^>]*\/?>/g, '\n')
      .replace(/<\/(w:tr|table:table-row)>/g, '\n')
      .replace(/<(w:tab|text:tab)\b[^>]*\/?>/g, '\t')
      .replace(/<[^>]+>/g, '')
  );

const extractFromZipDocument = (buffer: Buffer, filename: string): string => {
  let part: Buffer | null = null;

  try {
    part =
      readZipEntry(buffer, (name) => name === 'word/document.xml') ||
      readZipEntry(buffer, (name) => name === 'content.xml');
  } catch (error) {
    if (error instanceof ZipReadError) {
      throw new DocumentExtractionError(
        /password/i.test(error.message) ? 'password-protected' : 'corrupt',
        error.message
      );
    }
    throw error;
  }

  if (!part) {
    throw new DocumentExtractionError(
      'unsupported-format',
      `"${filename}" is a ZIP archive but not a Word or OpenDocument file.`
    );
  }

  return xmlPartToText(part.toString('utf8'));
};

const extractFromPdf = async (
  buffer: Buffer,
  filename: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true);
    let settled = false;

    const cleanup = () => {
      parser.removeAllListeners('pdfParser_dataReady');
      parser.removeAllListeners('pdfParser_dataError');
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      const message = error instanceof Error ? error.message : String(error);
      reject(
        new DocumentExtractionError(
          /password/i.test(message) ? 'password-protected' : 'corrupt',
          /password/i.test(message)
            ? `"${filename}" is password protected, so its text cannot be read.`
            : `"${filename}" could not be read: ${message}`
        )
      );
    };

    parser.on('pdfParser_dataReady', () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        resolve(parser.getRawTextContent());
      } catch (error) {
        fail(error);
      }
    });
    parser.on('pdfParser_dataError', (error) =>
      fail(
        typeof error === 'object' && error !== null && 'parserError' in error
          ? (error as { parserError: unknown }).parserError
          : error
      )
    );

    try {
      parser.parseBuffer(buffer);
    } catch (error) {
      fail(error);
    }
  });
};

const isProbablyPlainText = (buffer: Buffer): boolean => {
  const sample = buffer.subarray(0, Math.min(buffer.length, 2048));
  if (!sample.length) {
    return false;
  }
  if (sample.includes(0)) {
    return false;
  }

  let printable = 0;
  for (const byte of sample) {
    if (
      byte === 0x09 ||
      byte === 0x0a ||
      byte === 0x0d ||
      (byte >= 0x20 && byte <= 0x7e) ||
      byte >= 0x80
    ) {
      printable += 1;
    }
  }

  return printable / sample.length > 0.95;
};

/** Collapses the whitespace variations the supported formats produce. */
export const normalizeExtractedText = (text: string): string =>
  text
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    // Non-breaking and exotic spaces, which PDF exporters emit freely.
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // Zero-width and bidi marks carry no meaning in extracted text.
    .replace(/[\u200B-\u200F\u2028\u2029\u2060\uFEFF]/g, '')
    // Private-use glyphs come from icon fonts and are never content.
    .replace(/[\uE000-\uF8FF]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const extractDocumentText = async (
  input: DocumentExtractionInput
): Promise<string> => {
  const { buffer, filename, mimeType } = input;
  const minUsefulCharacters =
    Number.isSafeInteger(input.minUsefulCharacters) &&
    (input.minUsefulCharacters as number) > 0
      ? (input.minUsefulCharacters as number)
      : DEFAULT_MIN_USEFUL_CHARACTERS;

  if (!buffer.length) {
    throw new DocumentExtractionError('corrupt', `"${filename}" is empty.`);
  }

  let raw: string;
  if (looksLikePdf(buffer)) {
    raw = await extractFromPdf(buffer, filename);
  } else if (isZipContainer(buffer)) {
    raw = extractFromZipDocument(buffer, filename);
  } else if (isProbablyPlainText(buffer)) {
    raw = buffer.toString('utf8');
  } else {
    throw new DocumentExtractionError(
      'unsupported-format',
      `"${filename}" (${
        mimeType || 'unknown type'
      }) is not a PDF, Word, OpenDocument, or plain-text file.`
    );
  }

  const text = normalizeExtractedText(raw);

  if (text.replace(/\s/g, '').length < minUsefulCharacters) {
    throw new DocumentExtractionError(
      'no-selectable-text',
      `"${filename}" has no selectable text. If it is a scan or an image, paste the text or upload a text-based copy.`
    );
  }

  return text;
};
