import { deflateRawSync } from 'node:zlib';
import { extractDocxText, isDocx } from '../../src/document/docx.js';

/** A minimal zip archive with deflated entries, as Word writes them. */
function zip(entries: Record<string, string>): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const data = deflateRawSync(Buffer.from(content));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

describe('docx text', () => {
  it('reads paragraphs, tabs and entities from word/document.xml', () => {
    const document =
      '<w:document><w:body><w:p><w:r><w:t>AGENDA</w:t></w:r></w:p><w:p><w:r><w:t>TUESDAY, SEPTEMBER 8, 2026</w:t></w:r></w:p><w:p><w:r><w:t>6.</w:t></w:r><w:r><w:tab/><w:t>Lease &amp; Interlocal Agreement</w:t></w:r></w:p></w:body></w:document>';
    const bytes = zip({
      '[Content_Types].xml': '<Types/>',
      'word/document.xml': document,
    });
    expect(isDocx(bytes)).toBe(true);
    expect(extractDocxText(bytes)).toBe(
      'AGENDA\nTUESDAY, SEPTEMBER 8, 2026\n6.\tLease & Interlocal Agreement'
    );
  });

  it('does not treat other zip archives or PDFs as Word documents', () => {
    expect(isDocx(zip({ 'data.csv': 'a,b' }))).toBe(false);
    expect(isDocx(new Uint8Array(Buffer.from('%PDF-1.7 ...')))).toBe(false);
  });
});
