import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
  rmSync,
  mkdirSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface OcrOptions {
  lang?: string;
  dpi?: number;
  maxPages?: number;
  psm?: number;
  cacheDir?: string;
  cachePath?: string;
}

/**
 * OCR a PDF via pdftoppm (poppler) + tesseract 5.5.
 * Renders each page to PNG at 300 dpi and runs tesseract.
 * Caches result to <pdfPath>.ocr.txt so re-parses are instant.
 */
export async function ocrPdf(
  pdfPath: string,
  opts: OcrOptions = {}
): Promise<string> {
  const { lang = 'eng', dpi = 300, maxPages = 12, psm = 6 } = opts;
  const outputCachePath = opts.cachePath ?? `${pdfPath}.ocr.txt`;
  if (existsSync(outputCachePath)) {
    try {
      const cached = readFileSync(outputCachePath, 'utf8');
      if (cached.trim()) return cached;
    } catch {
      // fall through to re-ocr
    }
  }
  const workdir = mkdtempSync(join(tmpdir(), 'civic-ocr-'));
  const prefix = join(workdir, 'page');
  try {
    await execFileAsync('pdftoppm', [
      '-png',
      '-r',
      String(dpi),
      '-f',
      '1',
      '-l',
      String(maxPages),
      pdfPath,
      prefix,
    ]);
    const pages = readdirSync(workdir)
      .filter((f) => f.endsWith('.png'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (pages.length === 0) throw new Error('pdftoppm produced no pages');
    const texts: string[] = [];
    for (const page of pages) {
      const imagePath = join(workdir, page);
      const { stdout } = await execFileAsync(
        'tesseract',
        [imagePath, 'stdout', '-l', lang, '--psm', String(psm)],
        {
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      texts.push(stdout.trim());
    }
    const combined = texts
      .join('\n\n')
      .replace(/\f/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (combined.length > 0) {
      try {
        mkdirSync(dirname(outputCachePath), { recursive: true });
        writeFileSync(outputCachePath, combined);
      } catch {
        // cache is best-effort
      }
    }
    return combined;
  } finally {
    try {
      rmSync(workdir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

/** OCR durable PDF bytes without making a parser depend on a blob-store path. */
export async function ocrPdfBytes(
  bytes: Uint8Array,
  opts: OcrOptions = {}
): Promise<string> {
  const workdir = mkdtempSync(join(tmpdir(), 'civic-ocr-input-'));
  const pdfPath = join(workdir, 'document.pdf');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const cacheDir = opts.cacheDir ?? join(process.cwd(), 'data', 'ocr-cache');
  const cachePath =
    opts.cachePath ??
    join(cacheDir, 'sha256', digest.slice(0, 2), `${digest}.txt`);
  try {
    writeFileSync(pdfPath, bytes);
    return await ocrPdf(pdfPath, { ...opts, cachePath });
  } finally {
    try {
      rmSync(workdir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}
