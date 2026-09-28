import { AssetType } from '@optimistic-tanuki/models';
import * as path from 'path';

export const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.wmv': 'video/x-ms-wmv',
  '.m4v': 'video/mp4',
  '.ts': 'video/mp2t',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
};

export function extensionOf(name: string): string {
  return path.extname(name ?? '').toLowerCase();
}

export function mimeTypeFromFileName(name: string): string | null {
  return MIME_BY_EXTENSION[extensionOf(name)] ?? null;
}

export function mimeTypeForAssetType(type: AssetType): string {
  switch (type) {
    case AssetType.IMAGE:
      return 'image/png';
    case AssetType.VIDEO:
      return 'video/mp4';
    case AssetType.AUDIO:
      return 'audio/mpeg';
    case AssetType.DOCUMENT:
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

export function resolveDeclaredMimeType(name: string, type: AssetType): string {
  return mimeTypeFromFileName(name) ?? mimeTypeForAssetType(type);
}

export function isMediaMimeType(mimeType: string | null | undefined): boolean {
  if (!mimeType) {
    return false;
  }
  const normalized = mimeType.toLowerCase();
  return (
    normalized.startsWith('image/') ||
    normalized.startsWith('video/') ||
    normalized.startsWith('audio/')
  );
}
