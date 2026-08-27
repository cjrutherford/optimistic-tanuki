import { isZipContainer, readZipEntry, ZipReadError } from './zip-reader';
import PDFParser from 'pdf2json';

/**
 * Turns an uploaded resume into plain text, or says clearly why it cannot.
 *
 * The previous implementation scraped printable ASCII out of the raw bytes.
 * That only ever worked for `.txt`: a PDF keeps its text in compressed content
 * streams and a DOCX is a ZIP, so for the formats people actually upload the
 * scrape returned the container's scaffolding — `%PDF-1.7`, `/Type /Catalog`,
 * `endobj`, font names — and none of the resume. Everything downstream then
 * treated that as the candidate's own words: it went into the model prompt, it
 * became the summary in the deterministic fallback, and it became the corpus
 * the fact guard checks generated claims against.
 *
 * So the rule here is that unreadable input fails loudly. Returning empty or
 * partial text quietly is what produced the original bug.
 */

/** Why a file could not be read, in terms worth showing a user. */
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

const PDF_MAGIC = '%PDF-';

/**
 * Enough characters to be a resume rather than a stray fragment. A PDF whose
 * pages are scanned images yields a handful of stray glyphs at most.
 */
const MIN_USEFUL_CHARACTERS = 40;

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
    // Ampersand last, so an escaped entity is not double-decoded.
    .replace(/&amp;/g, '&');

/**
 * Pulls readable text out of WordprocessingML or ODF content.
 *
 * Both mark paragraphs and line breaks with elements rather than newlines, so
 * those are converted before tags are stripped — otherwise every bullet and
 * job title runs together into one line and the downstream line-based
 * heuristics see a single unusable blob.
 */
const xmlPartToText = (xml: string): string =>
  decodeXmlEntities(
    xml
      // Paragraph and line-break boundaries, in both vocabularies.
      .replace(/<\/(w:p|text:p|text:h)>/g, '\n')
      .replace(/<(w:br|w:cr|text:line-break)\b[^>]*\/?>/g, '\n')
      .replace(/<\/(w:tr|table:table-row)>/g, '\n')
      // Tabs carry column structure in resumes often enough to keep.
      .replace(/<(w:tab|text:tab)\b[^>]*\/?>/g, '\t')
      .replace(/<[^>]+>/g, '')
  );

const extractFromZipDocument = (buffer: Buffer, filename: string): string => {
  let part: Buffer | null = null;

  try {
    // DOCX keeps the body in word/document.xml; ODT in content.xml.
    part =
      readZipEntry(buffer, (name) => name === 'word/document.xml') ||
      readZipEntry(buffer, (name) => name === 'content.xml');
  } catch (error) {
    if (error instanceof ZipReadError) {
      throw new ResumeExtractionError(
        /password/i.test(error.message) ? 'password-protected' : 'corrupt',
        error.message
      );
    }
    throw error;
  }

  if (!part) {
    throw new ResumeExtractionError(
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
  // pdf2json is pure JavaScript and does not load the native canvas module used
  // by pdf-parse. Keep parsing event-based so malformed PDFs become a normal
  // extraction error rather than an unhandled parser exception.
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
        new ResumeExtractionError(
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
  // A NUL byte means binary; no text format we accept contains one.
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
      // Keep UTF-8 continuation bytes; accented names are not corruption.
      byte >= 0x80
    ) {
      printable += 1;
    }
  }

  return printable / sample.length > 0.95;
};

/** Collapses the whitespace variations the three formats produce. */
export const normalizeExtractedText = (text: string): string =>
  text
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    // Non-breaking and exotic spaces, which PDF exporters emit freely.
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // Zero-width and bidi marks carry no meaning in a resume.
    .replace(/[\u200B-\u200F\u2028\u2029\u2060\uFEFF]/g, '')
    // Private-use glyphs come from icon fonts and are never content.
    .replace(/[\uE000-\uF8FF]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const extractResumeText = async (
  input: ResumeExtractionInput
): Promise<string> => {
  const { buffer, filename, mimeType } = input;

  if (!buffer.length) {
    throw new ResumeExtractionError('corrupt', `"${filename}" is empty.`);
  }

  // Content is identified by its bytes, not its extension or declared type:
  // browsers routinely send application/octet-stream, and a mislabelled file
  // should still be read correctly rather than scraped.
  let raw: string;
  if (looksLikePdf(buffer)) {
    raw = await extractFromPdf(buffer, filename);
  } else if (isZipContainer(buffer)) {
    raw = extractFromZipDocument(buffer, filename);
  } else if (isProbablyPlainText(buffer)) {
    raw = buffer.toString('utf8');
  } else {
    throw new ResumeExtractionError(
      'unsupported-format',
      `"${filename}" (${
        mimeType || 'unknown type'
      }) is not a PDF, Word, OpenDocument, or plain-text file.`
    );
  }

  const text = normalizeExtractedText(raw);

  if (text.replace(/\s/g, '').length < MIN_USEFUL_CHARACTERS) {
    // Overwhelmingly a scan or an image-only export. Saying so is far more use
    // than handing the rest of the pipeline a near-empty string.
    throw new ResumeExtractionError(
      'no-selectable-text',
      `"${filename}" has no selectable text. If it is a scan or an image, paste the text or upload a text-based copy.`
    );
  }

  return text;
};
