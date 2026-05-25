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
  audience?: string;
  section?: string;
  parent?: string;
  tags: string[];
  kind: 'doc' | 'deck';
  headings: DocsHeading[];
  body: string;
  order?: number;
  landing?: boolean;
  docRole?: 'landing' | 'guide' | 'runbook' | 'reference';
  featured?: boolean;
  relatedPackages?: string[];
  lastUpdated?: string;
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

export interface ApiDocsIndexItem {
  slug: string;
  name: string;
  packageName: string;
  summary: string;
  sourceRoot: string;
  readmePath: string;
  outputPath: string;
  url: string;
  available: boolean;
  generatedAt?: string;
}
