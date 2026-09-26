import { deflateRawSync } from 'zlib';
import { EventEmitter } from 'events';

jest.mock('pdf2json', () => {
  class TestPdfParser extends EventEmitter {
    parseBuffer(buffer: Buffer): void {
      queueMicrotask(() =>
        buffer.length < 20
          ? this.emit('pdfParser_dataError', { parserError: 'truncated' })
          : this.emit('pdfParser_dataReady')
      );
    }

    getRawTextContent(): string {
      return 'Schedule C. Gross receipts: 120000. Expenses: 40000.';
    }
  }

  return { __esModule: true, default: TestPdfParser };
});

import {
  extractDocumentText,
  normalizeExtractedText,
  DocumentExtractionError,
} from './document-text.extractor';

const buildZip = (
  entries: Array<{ name: string; content: string }>
): Buffer => {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = deflateRawSync(Buffer.from(entry.content, 'utf8'));
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(entry.content.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(entry.content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    locals.push(local, data);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, eocd]);
};

const read = (
  buffer: Buffer,
  filename = 'document.pdf',
  mimeType = 'application/pdf',
  minUsefulCharacters?: number
) => extractDocumentText({ buffer, filename, mimeType, minUsefulCharacters });

describe('extractDocumentText', () => {
  it('reads a pdf text layer', async () => {
    const text = await read(
      Buffer.concat([
        Buffer.from('%PDF-1.7\nSchedule C body padding.'),
        Buffer.from(' '.repeat(64)),
      ])
    );

    expect(text).toContain('Gross receipts');
  });

  it('reads a docx document body', async () => {
    const text = await read(
      buildZip([
        {
          name: 'word/document.xml',
          content:
            '<w:document xmlns:w="urn:x"><w:body><w:p><w:r><w:t>Closing Disclosure statement</w:t></w:r></w:p><w:p><w:r><w:t>Borrower name here for verification</w:t></w:r></w:p></w:body></w:document>',
        },
      ]),
      'closing.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    expect(text).toContain('Closing Disclosure');
    expect(text).toContain('Borrower name here for verification');
  });

  it('reads an odt content file', async () => {
    const text = await read(
      buildZip([
        {
          name: 'content.xml',
          content:
            '<office:document-content xmlns:text="urn:x"><office:body><text:p>Deposition line one with testimony.</text:p><text:p>Deposition line two with testimony.</text:p></office:body></office:document-content>',
        },
      ]),
      'deposition.odt',
      'application/vnd.oasis.opendocument.text'
    );

    expect(text).toContain('Deposition line one with testimony.');
  });

  it('reads plain text identified by bytes rather than extension', async () => {
    const text = await read(
      Buffer.from('Meeting notes line one.\nMeeting notes line two.\n', 'utf8'),
      'notes.bin',
      'application/octet-stream'
    );

    expect(text).toContain('Meeting notes line one.');
  });

  it('rejects a zip that holds no document part', async () => {
    await expect(
      read(buildZip([{ name: 'other.txt', content: 'x'.repeat(64) }]), 'a.zip')
    ).rejects.toMatchObject({ reason: 'unsupported-format' });
  });

  it('rejects binary payloads', async () => {
    await expect(
      read(Buffer.from([0x41, 0x42, 0x00, 0x43, ...Array(64).fill(0x44)]))
    ).rejects.toMatchObject({ reason: 'unsupported-format' });
  });

  it('rejects empty input as corrupt', async () => {
    await expect(read(Buffer.alloc(0))).rejects.toMatchObject({
      reason: 'corrupt',
    });
  });

  it('rejects content below the useful threshold as having no selectable text', async () => {
    await expect(
      read(Buffer.from('short', 'utf8'), 'short.txt', 'text/plain')
    ).rejects.toMatchObject({ reason: 'no-selectable-text' });
  });

  it('honours a caller-supplied minimum', async () => {
    const text = await read(
      Buffer.from('short but enough', 'utf8'),
      'short.txt',
      'text/plain',
      5
    );
    expect(text).toBe('short but enough');
  });

  it('reports truncated pdfs as corrupt', async () => {
    await expect(
      read(Buffer.from('%PDF-1.4\nshort', 'latin1'))
    ).rejects.toMatchObject({ reason: 'corrupt' });
  });

  it('throws DocumentExtractionError with the reason attached', async () => {
    const error = await read(Buffer.alloc(0)).catch((e) => e);
    expect(error).toBeInstanceOf(DocumentExtractionError);
    expect(error.reason).toBe('corrupt');
  });

  it('normalizes whitespace, bidi marks, and icon-font glyphs', () => {
    expect(normalizeExtractedText('a\u00A0\u2003b\u200Bc\u200Ed\uE000e')).toBe(
      'a bcd e'
    );
  });
});
