import { deflateRawSync, deflateSync } from 'zlib';
import {
  extractResumeText,
  ResumeExtractionError,
} from './resume-text.extractor';

/**
 * These fixtures are built the way real exporters build them — text compressed
 * inside the container — because that is precisely what the previous extractor
 * could not read. A fixture holding plain text in the outer bytes would pass
 * against the broken implementation and prove nothing.
 */

const RESUME_LINES = [
  'Jane Rivera - Senior Platform Engineer',
  'Acme Robotics, 2019-2024',
  'Led migration of billing to Kubernetes, cutting deploy time 40%.',
  'Skills: TypeScript, PostgreSQL, Terraform, AWS',
];

/** A single-page PDF whose content stream is FlateDecode, as Word produces. */
const buildPdf = (lines: string[]): Buffer => {
  const content = `BT /F1 12 Tf 72 720 Td ${lines
    .map(
      (line, index) =>
        `${index ? '0 -18 Td ' : ''}(${line.replace(/([()\\])/g, '\\$1')}) Tj `
    )
    .join('')}ET`;
  const stream = deflateSync(Buffer.from(content, 'latin1'));

  const objects: Record<number, string> = {
    1: '<< /Type /Catalog /Pages 2 0 R >>',
    2: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    3: '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>',
    5: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  };

  let pdf = Buffer.from('%PDF-1.7\n', 'latin1');
  const offsets: Record<number, number> = {};
  const append = (chunk: Buffer | string) => {
    pdf = Buffer.concat([
      pdf,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'latin1'),
    ]);
  };

  for (const id of [1, 2, 3, 4, 5]) {
    offsets[id] = pdf.length;
    if (id === 4) {
      append(
        `4 0 obj\n<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`
      );
      append(stream);
      append('\nendstream\nendobj\n');
    } else {
      append(`${id} 0 obj\n${objects[id]}\nendobj\n`);
    }
  }

  const xref = pdf.length;
  let table = 'xref\n0 6\n0000000000 65535 f \n';
  for (const id of [1, 2, 3, 4, 5]) {
    table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  append(table);
  append(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return pdf;
};

/** Minimal ZIP writer, so DOCX/ODT fixtures are genuinely deflated. */
const buildZip = (entries: { name: string; content: string }[]): Buffer => {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  const crcTable = (() => {
    const table: number[] = [];
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();
  const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (const byte of buf) {
      c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };

  for (const entry of entries) {
    const raw = Buffer.from(entry.content, 'utf8');
    const deflated = deflateRawSync(raw);
    const nameBuf = Buffer.from(entry.name, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(Buffer.concat([local, nameBuf, deflated]));

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuf]));

    offset += 30 + nameBuf.length + deflated.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuf, eocd]);
};

const docx = (lines: string[]) =>
  buildZip([
    { name: '[Content_Types].xml', content: '<Types/>' },
    {
      name: 'word/document.xml',
      content: `<?xml version="1.0"?><w:document><w:body>${lines
        .map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`)
        .join('')}</w:body></w:document>`,
    },
  ]);

const odt = (lines: string[]) =>
  buildZip([
    { name: 'mimetype', content: 'application/vnd.oasis.opendocument.text' },
    {
      name: 'content.xml',
      content: `<?xml version="1.0"?><office:document-content><office:body>${lines
        .map((line) => `<text:p>${line}</text:p>`)
        .join('')}</office:body></office:document-content>`,
    },
  ]);

const read = (buffer: Buffer, filename = 'resume.pdf', mimeType = '') =>
  extractResumeText({ filename, mimeType, buffer });

describe('resume text extraction', () => {
  it('reads the text out of a PDF content stream', async () => {
    const text = await read(buildPdf(RESUME_LINES));

    for (const line of RESUME_LINES) {
      expect(text).toContain(line);
    }
  });

  it('returns no PDF scaffolding as if it were resume content', async () => {
    // The regression: byte-scraping returned exactly these tokens and none of
    // the resume, and they flowed into the model prompt and the fact guard.
    const text = await read(buildPdf(RESUME_LINES));

    for (const artefact of [
      '%PDF',
      'endobj',
      '/Type',
      '/Catalog',
      'FlateDecode',
      'xref',
      'startxref',
    ]) {
      expect(text).not.toContain(artefact);
    }
  });

  it('reads a DOCX, keeping paragraphs on their own lines', async () => {
    const text = await read(docx(RESUME_LINES), 'resume.docx');

    expect(text.split('\n')).toEqual(expect.arrayContaining(RESUME_LINES));
    expect(text).not.toContain('word/document.xml');
    expect(text).not.toContain('<w:t>');
  });

  it('reads an ODT', async () => {
    const text = await read(odt(RESUME_LINES), 'resume.odt');

    expect(text.split('\n')).toEqual(expect.arrayContaining(RESUME_LINES));
    expect(text).not.toContain('text:p');
  });

  it('decodes XML entities rather than leaving them escaped', async () => {
    const text = await read(
      docx([
        'Ana Ruiz &#8212; Research &amp; Development at Smith &amp; Co.',
        'Built tooling for &quot;always-on&quot; deployments across three teams.',
      ]),
      'resume.docx'
    );

    expect(text).toContain('Research & Development at Smith & Co.');
    expect(text).toContain('"always-on"');
    expect(text).toContain('—');
    expect(text).not.toContain('&amp;');
  });

  it('reads plain text', async () => {
    const text = await read(
      Buffer.from(RESUME_LINES.join('\n'), 'utf8'),
      'resume.txt',
      'text/plain'
    );

    expect(text).toContain('Jane Rivera');
  });

  it('identifies the format from the bytes, not the declared type', async () => {
    // Browsers routinely send application/octet-stream for uploads.
    const text = await read(
      buildPdf(RESUME_LINES),
      'resume',
      'application/octet-stream'
    );

    expect(text).toContain('Acme Robotics, 2019-2024');
  });

  describe('files it cannot read', () => {
    const reasonOf = async (promise: Promise<unknown>) => {
      try {
        await promise;
        return 'no-error';
      } catch (error) {
        return error instanceof ResumeExtractionError
          ? error.reason
          : `unexpected:${(error as Error).message}`;
      }
    };

    it('refuses a PDF with no selectable text instead of returning nothing', async () => {
      // A scan: valid PDF structure, an image where the words should be.
      expect(await reasonOf(read(buildPdf([])))).toBe('no-selectable-text');
    });

    it('refuses a file that is not a document at all', async () => {
      const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(400, 0),
      ]);

      expect(await reasonOf(read(png, 'photo.png', 'image/png'))).toBe(
        'unsupported-format'
      );
    });

    it('refuses a ZIP that is not a Word or OpenDocument file', async () => {
      const zip = buildZip([{ name: 'notes.txt', content: 'hello' }]);

      expect(await reasonOf(read(zip, 'archive.zip'))).toBe(
        'unsupported-format'
      );
    });

    it('refuses an empty file', async () => {
      expect(await reasonOf(read(Buffer.alloc(0), 'empty.pdf'))).toBe(
        'corrupt'
      );
    });

    it('refuses a truncated PDF rather than scraping what is left', async () => {
      const truncated = buildPdf(RESUME_LINES).subarray(0, 120);

      expect(await reasonOf(read(truncated))).not.toBe('no-error');
    });
  });
});
