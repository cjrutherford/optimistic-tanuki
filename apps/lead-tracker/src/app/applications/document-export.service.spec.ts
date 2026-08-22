import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GeneratedApplication } from '@optimistic-tanuki/models';
import { DocumentExportService } from './document-export.service';

const application = {
  leadId: 'lead-1',
  version: 2,
  modelGenerated: false,
  generatedAt: '2026-08-20T00:00:00.000Z',
  evidence: { gaps: [], removedClaims: [], clean: true },
  resume: {
    summary: 'Modernizer of <legacy> & "difficult" apps.',
    skills: ['React', 'TypeScript'],
    certifications: ['AWS Certified Solutions Architect'],
    roles: [
      {
        title: 'Senior Frontend Engineer',
        company: 'Globex',
        dateRange: '2020-2024',
        highlights: ['Cut dashboard load time by 40%'],
      },
    ],
  },
  coverLetter: {
    greeting: 'Dear Globex hiring team,',
    opening: 'I modernize legacy React applications.',
    body: ['I cut dashboard load time by 40%.'],
    closing: 'I would welcome a conversation.',
    signOff: 'Sincerely,',
  },
} as GeneratedApplication;

describe('DocumentExportService', () => {
  const service = new DocumentExportService();
  const dir = mkdtempSync(join(tmpdir(), 'ot-export-'));

  const writeOut = (
    kind: 'resume' | 'cover-letter',
    format: 'odt' | 'docx'
  ) => {
    const result = service.export(
      application,
      kind,
      format,
      'Chris Rutherford'
    );
    const path = join(dir, result.filename);
    writeFileSync(path, result.buffer);
    return { ...result, path };
  };

  it('names files by candidate, kind, and version', () => {
    expect(writeOut('resume', 'odt').filename).toBe(
      'chris-rutherford-resume-v2.odt'
    );
    expect(writeOut('cover-letter', 'docx').filename).toBe(
      'chris-rutherford-cover-letter-v2.docx'
    );
  });

  it.each([
    ['resume', 'odt'],
    ['resume', 'docx'],
    ['cover-letter', 'odt'],
    ['cover-letter', 'docx'],
  ] as const)('produces a readable archive for %s.%s', (kind, format) => {
    const { path } = writeOut(kind, format);
    // Uses the real unzip so a subtly malformed container cannot pass.
    const output = execFileSync('unzip', ['-t', path], { encoding: 'utf8' });
    expect(output).toContain('No errors detected');
  });

  it('puts the ODT mimetype entry first and uncompressed, as the spec requires', () => {
    const { path } = writeOut('resume', 'odt');
    const listing = execFileSync('unzip', ['-lv', path], { encoding: 'utf8' });
    const rows = listing
      .split('\n')
      .filter((line) => /mimetype|content\.xml/.test(line));

    expect(rows[0]).toContain('mimetype');
    // "Stored" means no compression; readers reject a deflated mimetype entry.
    expect(rows[0]).toContain('Stored');
  });

  it('escapes XML so user prose cannot corrupt the document', () => {
    const { path } = writeOut('resume', 'odt');
    const content = execFileSync('unzip', ['-p', path, 'content.xml'], {
      encoding: 'utf8',
    });

    expect(content).toContain('&lt;legacy&gt;');
    expect(content).toContain('&quot;difficult&quot;');
    expect(content).toContain('&amp;');
    expect(content).not.toContain('<legacy>');
  });

  it('emits real heading and list markup rather than flat text', () => {
    const odt = execFileSync(
      'unzip',
      ['-p', writeOut('resume', 'odt').path, 'content.xml'],
      { encoding: 'utf8' }
    );
    expect(odt).toContain('text:outline-level="1"');
    expect(odt).toContain('<text:list>');

    const docx = execFileSync(
      'unzip',
      ['-p', writeOut('resume', 'docx').path, 'word/document.xml'],
      { encoding: 'utf8' }
    );
    expect(docx).toContain('Heading1');
    expect(docx).toContain('<w:numPr>');
  });

  it('keeps both formats showing the same content', () => {
    const odt = execFileSync(
      'unzip',
      ['-p', writeOut('resume', 'odt').path, 'content.xml'],
      { encoding: 'utf8' }
    );
    const docx = execFileSync(
      'unzip',
      ['-p', writeOut('resume', 'docx').path, 'word/document.xml'],
      { encoding: 'utf8' }
    );

    for (const fragment of [
      'Cut dashboard load time by 40%',
      'AWS Certified Solutions Architect',
      'Senior Frontend Engineer',
    ]) {
      expect(odt).toContain(fragment);
      expect(docx).toContain(fragment);
    }
  });
});
