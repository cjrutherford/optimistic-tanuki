import { Injectable } from '@nestjs/common';
import {
  ApplicationDocumentKind,
  ApplicationExportFormat,
  GeneratedApplication,
  TailoredCoverLetter,
  TailoredResume,
} from '@optimistic-tanuki/models';
import { createZip, escapeXml, ZipEntry } from './zip-writer';

/** A block of document content, independent of output format. */
type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string };

/**
 * Renders generated documents as OpenDocument Text (.odt) and Word (.docx).
 *
 * Both are produced from the same block list, so the two formats cannot drift
 * into showing different content. Real heading and list styles are emitted
 * rather than a flattened text dump, so the file is editable in Word or
 * LibreOffice the way a normal document is.
 */
@Injectable()
export class DocumentExportService {
  export(
    application: GeneratedApplication,
    kind: ApplicationDocumentKind,
    format: ApplicationExportFormat,
    candidateName: string
  ): { filename: string; contentType: string; buffer: Buffer } {
    const blocks =
      kind === 'resume'
        ? this.resumeBlocks(application.resume, candidateName)
        : this.coverLetterBlocks(application.coverLetter, candidateName);

    const safeName = (candidateName || 'application')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    const base = `${safeName}-${kind}-v${application.version}`;

    if (format === 'odt') {
      return {
        filename: `${base}.odt`,
        contentType: 'application/vnd.oasis.opendocument.text',
        buffer: this.buildOdt(blocks),
      };
    }

    return {
      filename: `${base}.docx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: this.buildDocx(blocks),
    };
  }

  private resumeBlocks(resume: TailoredResume, name: string): Block[] {
    const blocks: Block[] = [{ kind: 'heading', text: name }];

    if (resume.summary) {
      blocks.push({ kind: 'subheading', text: 'Summary' });
      blocks.push({ kind: 'paragraph', text: resume.summary });
    }

    if (resume.skills?.length) {
      blocks.push({ kind: 'subheading', text: 'Skills' });
      blocks.push({ kind: 'paragraph', text: resume.skills.join(' · ') });
    }

    if (resume.roles?.length) {
      blocks.push({ kind: 'subheading', text: 'Experience' });
      for (const role of resume.roles) {
        const heading = [role.title, role.company].filter(Boolean).join(' — ');
        blocks.push({
          kind: 'paragraph',
          text: role.dateRange ? `${heading} (${role.dateRange})` : heading,
        });
        for (const highlight of role.highlights || []) {
          blocks.push({ kind: 'bullet', text: highlight });
        }
      }
    }

    if (resume.certifications?.length) {
      blocks.push({ kind: 'subheading', text: 'Certifications' });
      for (const cert of resume.certifications) {
        blocks.push({ kind: 'bullet', text: cert });
      }
    }

    return blocks;
  }

  private coverLetterBlocks(
    letter: TailoredCoverLetter,
    name: string
  ): Block[] {
    return [
      { kind: 'heading', text: name },
      ...(letter.greeting
        ? [{ kind: 'paragraph' as const, text: letter.greeting }]
        : []),
      ...(letter.opening
        ? [{ kind: 'paragraph' as const, text: letter.opening }]
        : []),
      ...(letter.body || []).map((text) => ({
        kind: 'paragraph' as const,
        text,
      })),
      ...(letter.closing
        ? [{ kind: 'paragraph' as const, text: letter.closing }]
        : []),
      ...(letter.signOff
        ? [{ kind: 'paragraph' as const, text: letter.signOff }]
        : []),
      { kind: 'paragraph', text: name },
    ];
  }

  private buildOdt(blocks: Block[]): Buffer {
    const body = blocks
      .map((block) => {
        const text = escapeXml(block.text);
        switch (block.kind) {
          case 'heading':
            return `<text:h text:outline-level="1">${text}</text:h>`;
          case 'subheading':
            return `<text:h text:outline-level="2">${text}</text:h>`;
          case 'bullet':
            return `<text:list><text:list-item><text:p>${text}</text:p></text:list-item></text:list>`;
          default:
            return `<text:p>${text}</text:p>`;
        }
      })
      .join('');

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text>${body}</office:text></office:body></office:document-content>`;

    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`;

    const entries: ZipEntry[] = [
      // Must be first and uncompressed, per the OpenDocument packaging spec.
      {
        path: 'mimetype',
        content: 'application/vnd.oasis.opendocument.text',
        store: true,
      },
      { path: 'META-INF/manifest.xml', content: manifest },
      { path: 'content.xml', content },
    ];

    return createZip(entries);
  }

  private buildDocx(blocks: Block[]): Buffer {
    const paragraphs = blocks
      .map((block) => {
        const text = escapeXml(block.text);
        const style =
          block.kind === 'heading'
            ? '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>'
            : block.kind === 'subheading'
            ? '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>'
            : block.kind === 'bullet'
            ? '<w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'
            : '';
        return `<w:p>${style}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
      })
      .join('');

    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

    return createZip([
      { path: '[Content_Types].xml', content: contentTypes },
      { path: '_rels/.rels', content: rootRels },
      { path: 'word/document.xml', content: document },
    ]);
  }
}
