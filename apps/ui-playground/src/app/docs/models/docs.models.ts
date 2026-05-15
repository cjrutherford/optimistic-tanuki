export interface DocsHeading {
  depth: number;
  text: string;
  id: string;
}

export interface DocsManifestItem {
  slug: string;
  title: string;
  summary: string;
  sourcePath: string;
  category: string;
  tags: string[];
  kind: 'doc' | 'deck';
  headings: DocsHeading[];
  body: string;
  order?: number;
}

export interface DocsManifest {
  version: number;
  generatedAt: string;
  items: DocsManifestItem[];
}

export interface DocsCategory {
  id: string;
  title: string;
  documents: DocsManifestItem[];
}

export interface DocsSearchDocument {
  slug: string;
  title: string;
  summary: string;
  category: string;
  headings: DocsHeading[];
  tags: string[];
}

export interface MarkdownRenderOptions {
  sourcePath: string;
}

export interface MarkdownRenderResult {
  html: string;
  toc: DocsHeading[];
  outboundLinks: string[];
  embeddedBlocks: Array<{ type: string; raw: string }>;
}
