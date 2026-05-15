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

@Injectable({ providedIn: 'root' })
export class MarkdownRendererService {
  render(
    markdown: string,
    options: MarkdownRenderOptions
  ): MarkdownRenderResult {
    const toc: DocsHeading[] = [];
    const outboundLinks: string[] = [];
    const embeddedBlocks: Array<{ type: string; raw: string }> = [];

    const lines = markdown.split(/\r?\n/);
    const htmlParts: string[] = [];
    let inCodeFence = false;
    let codeFenceLanguage = '';
    let codeFenceLines: string[] = [];
    let paragraphLines: string[] = [];
    let listItems: string[] = [];

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const renderInline = (value: string) =>
      value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, href) => {
        if (/^(https?:|mailto:|tel:)/i.test(href)) {
          outboundLinks.push(href);
          return `<a href="${href}" target="_blank" rel="noreferrer">${escapeHtml(
            text
          )}</a>`;
        }

        if (href.endsWith('.md')) {
          const resolvedSource = resolveRelativeMarkdownPath(
            options.sourcePath,
            href
          );
          const targetSlug = sourcePathToRouteSlug(resolvedSource);
          return `<a href="/docs/${targetSlug}">${escapeHtml(text)}</a>`;
        }

        return `<a href="${href}">${escapeHtml(text)}</a>`;
      });

    const flushParagraph = () => {
      if (!paragraphLines.length) {
        return;
      }

      htmlParts.push(
        `<p>${renderInline(escapeHtml(paragraphLines.join(' ')))}</p>`
      );
      paragraphLines = [];
    };

    const flushList = () => {
      if (!listItems.length) {
        return;
      }

      htmlParts.push(
        `<ul>${listItems
          .map((item) => `<li>${renderInline(escapeHtml(item))}</li>`)
          .join('')}</ul>`
      );
      listItems = [];
    };

    const flushCodeFence = () => {
      if (!inCodeFence) {
        return;
      }

      const language = codeFenceLanguage
        ? ` data-language="${escapeHtml(codeFenceLanguage)}"`
        : '';
      htmlParts.push(
        `<pre class="docs-code-block"><code${language}>${escapeHtml(
          codeFenceLines.join('\n')
        )}</code></pre>`
      );
      inCodeFence = false;
      codeFenceLanguage = '';
      codeFenceLines = [];
    };

    for (const line of lines) {
      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line.trim());
      const codeFenceMatch = /^```(.*)$/.exec(line.trim());
      const listMatch = /^-\s+(.+)$/.exec(line.trim());

      if (codeFenceMatch) {
        flushParagraph();
        flushList();

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
        flushParagraph();
        flushList();
        const depth = headingMatch[1].length;
        const text = headingMatch[2].trim();
        const id = slugify(text);
        toc.push({ depth, text, id });
        htmlParts.push(`<h${depth} id="${id}">${escapeHtml(text)}</h${depth}>`);
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        continue;
      }

      if (listMatch) {
        flushParagraph();
        listItems.push(listMatch[1].trim());
        continue;
      }

      paragraphLines.push(line.trim());
    }

    flushParagraph();
    flushList();
    flushCodeFence();

    const html = htmlParts.join('');
    const sanitizedHtml = DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
    });

    const processBlockPattern = /```process\n([\s\S]*?)```/g;
    let match;
    while ((match = processBlockPattern.exec(markdown)) !== null) {
      embeddedBlocks.push({ type: 'process', raw: match[1].trim() });
    }

    return {
      html: sanitizedHtml,
      toc,
      outboundLinks,
      embeddedBlocks,
    };
  }
}
