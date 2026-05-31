import { Injectable } from '@angular/core';
import DOMPurify from 'dompurify';
import {
  DocsHeading,
  MarkdownRenderOptions,
  MarkdownRenderResult,
} from '../models/docs.models';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sourcePathToRouteSlug(sourcePath: string): string {
  return sourcePath
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .split('/')
    .map((segment) => slugify(segment) || segment.toLowerCase())
    .join('/');
}

function resolveRelativeMarkdownPath(
  currentSourcePath: string,
  href: string
): string {
  const currentSegments = currentSourcePath.replace(/\\/g, '/').split('/');
  currentSegments.pop();

  for (const segment of href.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      currentSegments.pop();
      continue;
    }

    currentSegments.push(segment);
  }

  return currentSegments.join('/');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Strip a leading YAML frontmatter block (`--- ... ---`). The build-time
 * docs manifest already parses frontmatter into metadata fields, but
 * older entries may still embed the raw block in `body`; we never want
 * to render it as content.
 */
function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith('---\n') && !markdown.startsWith('---\r\n')) {
    return markdown;
  }
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) {
    return markdown;
  }
  // Skip past the closing fence and any trailing newline.
  const afterFence = markdown.slice(end + 4);
  return afterFence.replace(/^\r?\n/, '');
}

@Injectable({ providedIn: 'root' })
export class MarkdownRendererService {
  render(
    markdown: string,
    options: MarkdownRenderOptions
  ): MarkdownRenderResult {
    const toc: DocsHeading[] = [];
    const outboundLinks: string[] = [];
    const embeddedBlocks: Array<{ type: string; raw: string }> = [];

    const cleaned = stripFrontmatter(markdown);
    const lines = cleaned.split(/\r?\n/);
    const htmlParts: string[] = [];
    let inCodeFence = false;
    let codeFenceLanguage = '';
    let codeFenceLines: string[] = [];
    let paragraphLines: string[] = [];
    let listItems: string[] = [];
    let listKind: 'ul' | 'ol' | null = null;
    let blockquoteLines: string[] = [];

    const renderInline = (value: string): string => {
      // Tokenize: walk the string, extracting image and link tokens. Text
      // between/around tokens is passed through `escapeInline` so emphasis,
      // code spans, and HTML escaping all apply uniformly.
      const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
      const linkRegex = /\[([^\]]+)\]\(([^)\s]+)\)/g;

      type Token = { start: number; end: number; html: string };
      const tokens: Token[] = [];

      let imgMatch: RegExpExecArray | null;
      while ((imgMatch = imageRegex.exec(value)) !== null) {
        const [full, alt, src, title] = imgMatch;
        const safeSrc = /^(https?:|data:)/i.test(src) ? src : '';
        const html = safeSrc
          ? `<img class="docs-image" src="${escapeHtml(
              safeSrc
            )}" alt="${escapeHtml(alt)}"${
              title ? ` title="${escapeHtml(title)}"` : ''
            } loading="lazy" />`
          : escapeHtml(alt);
        tokens.push({
          start: imgMatch.index,
          end: imgMatch.index + full.length,
          html,
        });
      }

      let linkMatch: RegExpExecArray | null;
      while ((linkMatch = linkRegex.exec(value)) !== null) {
        const start = linkMatch.index;
        // Skip if this is actually an image (preceded by '!') or overlaps an
        // already-captured image token.
        if (start > 0 && value[start - 1] === '!') continue;
        const end = start + linkMatch[0].length;
        if (tokens.some((t) => start < t.end && end > t.start)) continue;

        const [, text, href] = linkMatch;
        let html: string;
        if (/^(https?:|mailto:|tel:)/i.test(href)) {
          outboundLinks.push(href);
          html = `<a href="${escapeHtml(
            href
          )}" target="_blank" rel="noreferrer">${escapeInline(text)}</a>`;
        } else if (href.endsWith('.md') || /\.md#/.test(href)) {
          const [pathPart, hashPart] = href.split('#');
          const resolvedSource = resolveRelativeMarkdownPath(
            options.sourcePath,
            pathPart
          );
          const targetSlug = sourcePathToRouteSlug(resolvedSource);
          // Escape hashPart to prevent attribute breakout via crafted
          // markdown like `[x](file.md#"><script>)`.
          const hash = hashPart ? `#${escapeHtml(hashPart)}` : '';
          html = `<a href="/docs/${targetSlug}${hash}">${escapeInline(
            text
          )}</a>`;
        } else {
          html = `<a href="${escapeHtml(href)}">${escapeInline(text)}</a>`;
        }
        tokens.push({ start, end, html });
      }

      tokens.sort((a, b) => a.start - b.start);

      const out: string[] = [];
      let cursor = 0;
      for (const tok of tokens) {
        if (tok.start > cursor) {
          out.push(escapeInline(value.slice(cursor, tok.start)));
        }
        out.push(tok.html);
        cursor = tok.end;
      }
      if (cursor < value.length) {
        out.push(escapeInline(value.slice(cursor)));
      }
      return out.join('');
    };

    /**
     * Apply inline emphasis (bold, italic, code) and HTML-escape any
     * remaining content. Run AFTER links/images so their HTML output is
     * preserved.
     */
    const escapeInline = (value: string): string => {
      // We perform escaping piecewise so that backtick-delimited code spans
      // do not have their contents re-processed by emphasis regexes.
      const parts: string[] = [];
      const codeRegex = /`([^`]+)`/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = codeRegex.exec(value)) !== null) {
        parts.push(
          applyEmphasis(escapeHtml(value.slice(lastIndex, match.index)))
        );
        parts.push(`<code>${escapeHtml(match[1])}</code>`);
        lastIndex = match.index + match[0].length;
      }
      parts.push(applyEmphasis(escapeHtml(value.slice(lastIndex))));
      return parts.join('');
    };

    const applyEmphasis = (escaped: string): string => {
      // Bold: **text** or __text__
      let result = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      // Italic: *text* or _text_  (avoid matching word_inside_word)
      result = result.replace(
        /(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g,
        '$1<em>$2</em>'
      );
      result = result.replace(
        /(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g,
        '$1<em>$2</em>'
      );
      // Strikethrough: ~~text~~
      result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      return result;
    };

    const flushParagraph = () => {
      if (!paragraphLines.length) return;
      htmlParts.push(`<p>${renderInline(paragraphLines.join(' '))}</p>`);
      paragraphLines = [];
    };

    const flushList = () => {
      if (!listItems.length || !listKind) return;
      const tag = listKind;
      htmlParts.push(
        `<${tag}>${listItems
          .map((item) => `<li>${renderInline(item)}</li>`)
          .join('')}</${tag}>`
      );
      listItems = [];
      listKind = null;
    };

    const flushBlockquote = () => {
      if (!blockquoteLines.length) return;
      htmlParts.push(
        `<blockquote>${blockquoteLines
          .map((line) => `<p>${renderInline(line)}</p>`)
          .join('')}</blockquote>`
      );
      blockquoteLines = [];
    };

    const flushCodeFence = () => {
      if (!inCodeFence) return;
      const language = codeFenceLanguage
        ? ` data-language="${escapeHtml(codeFenceLanguage)}"`
        : '';
      const languageClass = codeFenceLanguage
        ? ` class="language-${escapeHtml(codeFenceLanguage)}"`
        : '';
      htmlParts.push(
        `<pre class="docs-code-block"${language}><code${languageClass}>${escapeHtml(
          codeFenceLines.join('\n')
        )}</code></pre>`
      );
      inCodeFence = false;
      codeFenceLanguage = '';
      codeFenceLines = [];
    };

    const flushAllBlocks = () => {
      flushParagraph();
      flushList();
      flushBlockquote();
    };

    const isTableSeparator = (line: string): boolean =>
      /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);

    const splitTableRow = (line: string): string[] => {
      const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
      return trimmed.split('|').map((cell) => cell.trim());
    };

    const parseAlignments = (
      separator: string
    ): Array<'left' | 'right' | 'center' | null> => {
      return splitTableRow(separator).map((cell) => {
        const left = cell.startsWith(':');
        const right = cell.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        if (left) return 'left';
        return null;
      });
    };

    const tryConsumeTable = (startIndex: number): number => {
      const headerLine = lines[startIndex];
      const separatorLine = lines[startIndex + 1];
      if (!headerLine || !separatorLine) return -1;
      if (!headerLine.includes('|')) return -1;
      if (!isTableSeparator(separatorLine)) return -1;

      const headerCells = splitTableRow(headerLine);
      const alignments = parseAlignments(separatorLine);
      const bodyRows: string[][] = [];

      let cursor = startIndex + 2;
      while (cursor < lines.length) {
        const candidate = lines[cursor];
        if (!candidate.trim() || !candidate.includes('|')) break;
        bodyRows.push(splitTableRow(candidate));
        cursor++;
      }

      const alignClass = (index: number): string => {
        const align = alignments[index];
        return align ? ` class="docs-align-${align}"` : '';
      };

      const headHtml = `<thead><tr>${headerCells
        .map(
          (cell, index) => `<th${alignClass(index)}>${renderInline(cell)}</th>`
        )
        .join('')}</tr></thead>`;

      const bodyHtml = `<tbody>${bodyRows
        .map(
          (row) =>
            `<tr>${row
              .map(
                (cell, index) =>
                  `<td${alignClass(index)}>${renderInline(cell)}</td>`
              )
              .join('')}</tr>`
        )
        .join('')}</tbody>`;

      htmlParts.push(
        `<div class="docs-table-wrap"><table class="docs-table">${headHtml}${bodyHtml}</table></div>`
      );
      return cursor - 1;
    };

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const trimmed = line.trim();

      const codeFenceMatch = /^```(.*)$/.exec(trimmed);
      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
      const ulMatch = /^[-*+]\s+(.+)$/.exec(trimmed);
      const olMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
      const blockquoteMatch = /^>\s?(.*)$/.exec(trimmed);
      const hrMatch = /^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed);

      if (codeFenceMatch) {
        flushAllBlocks();
        if (inCodeFence) {
          flushCodeFence();
        } else {
          inCodeFence = true;
          codeFenceLanguage = codeFenceMatch[1].trim();
        }
        continue;
      }

      if (inCodeFence) {
        codeFenceLines.push(line);
        continue;
      }

      if (headingMatch) {
        flushAllBlocks();
        const depth = headingMatch[1].length;
        const text = headingMatch[2].trim();
        const id = slugify(text);
        toc.push({ depth, text, id });
        htmlParts.push(
          `<h${depth} id="${id}"><a class="docs-heading-anchor" href="#${id}" aria-label="Link to ${escapeHtml(
            text
          )}">${renderInline(text)}</a></h${depth}>`
        );
        continue;
      }

      if (hrMatch) {
        flushAllBlocks();
        htmlParts.push('<hr class="docs-hr" />');
        continue;
      }

      if (!trimmed) {
        flushAllBlocks();
        continue;
      }

      // Tables: try header + separator detection.
      if (
        !listItems.length &&
        !blockquoteLines.length &&
        !paragraphLines.length &&
        trimmed.includes('|') &&
        lines[index + 1] &&
        isTableSeparator(lines[index + 1])
      ) {
        const newIndex = tryConsumeTable(index);
        if (newIndex >= 0) {
          index = newIndex;
          continue;
        }
      }

      if (blockquoteMatch) {
        flushParagraph();
        flushList();
        blockquoteLines.push(blockquoteMatch[1]);
        continue;
      }

      if (ulMatch) {
        flushParagraph();
        flushBlockquote();
        if (listKind && listKind !== 'ul') flushList();
        listKind = 'ul';
        listItems.push(ulMatch[1].trim());
        continue;
      }

      if (olMatch) {
        flushParagraph();
        flushBlockquote();
        if (listKind && listKind !== 'ol') flushList();
        listKind = 'ol';
        listItems.push(olMatch[1].trim());
        continue;
      }

      paragraphLines.push(line.trim());
    }

    flushAllBlocks();
    flushCodeFence();

    const html = htmlParts.join('');
    const sanitizedHtml = DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target', 'rel', 'loading', 'data-language'],
    });

    const processBlockPattern = /```process\n([\s\S]*?)```/g;
    let processMatch;
    while ((processMatch = processBlockPattern.exec(cleaned)) !== null) {
      embeddedBlocks.push({ type: 'process', raw: processMatch[1].trim() });
    }

    return {
      html: sanitizedHtml,
      toc,
      outboundLinks,
      embeddedBlocks,
    };
  }
}
