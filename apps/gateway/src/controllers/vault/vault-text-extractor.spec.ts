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
      return 'Deposition transcript. Q. State your name. A. Jane Rivera.';
    }
  }

  return { __esModule: true, default: TestPdfParser };
});

import { extractVaultText } from './vault-text-extractor';

describe('extractVaultText', () => {
  const TRANSCRIPT = `TRANSCRIPT OF PROCEEDINGS
Case No. 3:24-cv-01842-JLT

Q.  Are you the custodian of records?
A.  I am.`;

  const buildDocx = (paragraphs: string[]): Buffer => {
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
      paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('') +
      `</w:body></w:document>`;
    const data = deflateRawSync(Buffer.from(xml, 'utf8'));
    const name = Buffer.from('word/document.xml', 'utf8');
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(xml.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 18);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(xml.length, 22);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt16LE(0, 38);
    central.writeUInt32LE(0, 42);
    name.copy(central, 46);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(central.length, 12);
    eocd.writeUInt32LE(local.length + data.length, 16);
    return Buffer.concat([local, data, central, eocd]);
  };

  it('reads a text document', async () => {
    const result = await extractVaultText(Buffer.from(TRANSCRIPT, 'utf8'));

    expect(result.extracted).toBe(true);
    expect(result.text).toBe(
      'TRANSCRIPT OF PROCEEDINGS\nCase No. 3:24-cv-01842-JLT\n\nQ. Are you the custodian of records?\nA. I am.'
    );
  });

  it('reads a pdf text layer instead of refusing it', async () => {
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.7\nDeposition transcript body padding.'),
      Buffer.from(' '.repeat(64)),
    ]);

    const result = await extractVaultText(pdf, 'deposition.pdf');

    expect(result.extracted).toBe(true);
    expect(result.text).toContain('Jane Rivera');
  });

  it('reads a docx word document', async () => {
    const result = await extractVaultText(
      buildDocx([
        'Closing Disclosure statement',
        'Borrower: Jane Rivera for verification',
      ]),
      'closing.docx'
    );

    expect(result.extracted).toBe(true);
    expect(result.text).toContain('Closing Disclosure');
    expect(result.text).toContain('Borrower: Jane Rivera');
  });

  it('reports a truncated pdf as corrupt rather than guessing', async () => {
    const result = await extractVaultText(
      Buffer.from('%PDF-1.4\nshort', 'latin1'),
      'broken.pdf'
    );

    expect(result.extracted).toBe(false);
    expect(result.text).toBe('');
    expect(result.reason).toBe('corrupt');
  });

  it('refuses a binary payload that claimed to be text', async () => {
    const result = await extractVaultText(
      Buffer.from([0x41, 0x42, 0x00, 0x43, 0x44]),
      'notes.txt'
    );

    expect(result.extracted).toBe(false);
    expect(result.reason).toBe('unsupported-format');
  });

  it('reports an empty upload rather than storing an empty document as readable', async () => {
    await expect(extractVaultText(Buffer.alloc(0))).resolves.toEqual({
      text: '',
      extracted: false,
      reason: 'no_content',
    });
  });

  it('reports a file with no readable text in it', async () => {
    const result = await extractVaultText(
      Buffer.from('   \n\n  ', 'utf8'),
      'blank.txt'
    );

    expect(result.extracted).toBe(false);
    expect(result.reason).toBe('no-selectable-text');
  });

  it('refuses an oversized upload without reading it', async () => {
    const result = await extractVaultText(
      Buffer.alloc(4 * 1024 * 1024 + 1, 0x41),
      'huge.txt'
    );

    expect(result.extracted).toBe(false);
    expect(result.reason).toBe('too_large');
  });

  it('strips a byte order mark so the first heading is not corrupted', async () => {
    const result = await extractVaultText(
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(TRANSCRIPT, 'utf8'),
      ])
    );

    expect(result.text.startsWith('TRANSCRIPT')).toBe(true);
  });
});
