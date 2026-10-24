import { createHash, randomUUID } from 'node:crypto';
import {
  open,
  lstat,
  mkdir,
  readdir,
  rmdir,
  unlink,
  type FileHandle,
} from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import {
  ACCOUNT_EXPORT_HLS_LIMITS,
  parseAccountExportHlsPlaylist,
  rewriteAccountExportHlsPlaylist,
} from './account-export-hls';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ASSETS = 64;
const MAX_CHUNK = 64 * 1024;
const MAX_BASE64 = 96 * 1024;
const MAX_TOTAL = 512 * 1024 * 1024;

type Mime = { mimeType: string; extension: string };
type AssetState = {
  id: string;
  profileId: string;
  fileName: string;
  handle: FileHandle;
  offset: number;
  hash: ReturnType<typeof createHash>;
  mime?: Mime;
  manifest?: Record<string, unknown>;
  refs?: string[];
  sourceSha256?: string;
  sourceSizeBytes?: number;
  closed?: boolean;
};

export interface AccountExportArtifactMediaEntry {
  assetId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  sourceSha256?: string;
  sourceSizeBytes?: number;
  hlsReferenceAssetIds?: string[];
  createReadStream(): Readable;
  cleanup(): Promise<void>;
}

/** Collects bounded assetMedia owner records into private, unlinked file-backed artifact entries. */
export class AccountExportArtifactMediaCollector {
  private readonly assets = new Map<string, AssetState>();
  private readonly profiles = new Map<string, string>();
  private readonly entries: AccountExportArtifactMediaEntry[] = [];
  private totalBytes = 0;
  private finished = false;
  private closed = false;
  private cleanupPromise?: Promise<void>;
  private privateRoot?: string;

  constructor(
    private readonly options: {
      root: string;
      signal?: AbortSignal;
      maxBytes: number;
    }
  ) {
    if (
      !Number.isSafeInteger(options.maxBytes) ||
      options.maxBytes < 1 ||
      options.maxBytes > MAX_TOTAL
    )
      throw new Error('MEDIA_BUDGET_INVALID');
  }

  async accept(data: Record<string, unknown>): Promise<void> {
    this.checkOpen();
    try {
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error('MEDIA_RECORD_INVALID');
      if (data['kind'] === 'bytes') await this.acceptBytes(data);
      else if (data['kind'] === 'manifest') await this.acceptManifest(data);
      else throw new Error('MEDIA_RECORD_INVALID');
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  async finish(): Promise<AccountExportArtifactMediaEntry[]> {
    this.checkOpen();
    this.finished = true;
    try {
      if ([...this.assets.values()].some((asset) => !asset.manifest))
        throw new Error('MEDIA_MANIFEST_MISSING');
      for (const asset of this.assets.values())
        for (const ref of asset.refs ?? [])
          if (!this.assets.has(ref) || !this.assets.get(ref)?.manifest)
            throw new Error('MEDIA_HLS_REFERENCE_MISSING');
      for (const asset of this.assets.values()) {
        if (!asset.refs) continue;
        if (!asset.manifest) throw new Error('MEDIA_MANIFEST_MISSING');
        const source = await readAll(asset.handle, asset.offset);
        const portable = rewriteAccountExportHlsPlaylist(source, (id) => {
          const target = this.assets.get(id);
          return target?.manifest && target.mime?.mimeType === 'video/mp2t'
            ? { fileName: target.fileName, mimeType: target.mime.mimeType }
            : undefined;
        });
        const updatedTotal = this.totalBytes - asset.offset + portable.length;
        if (updatedTotal > this.options.maxBytes || updatedTotal > MAX_TOTAL)
          throw new Error('MEDIA_BUDGET_EXCEEDED');
        await asset.handle.truncate(0);
        let written = 0;
        while (written < portable.length) {
          const result = await asset.handle.write(
            portable,
            written,
            portable.length - written,
            written
          );
          if (!result.bytesWritten) throw new Error('MEDIA_WRITE_FAILED');
          written += result.bytesWritten;
        }
        asset.offset = portable.length;
        asset.hash = createHash('sha256').update(portable);
        this.totalBytes = updatedTotal;
        asset.sourceSha256 = String(asset.manifest['sha256']);
        asset.sourceSizeBytes = Number(asset.manifest['sizeBytes']);
        if (!portablePlaylistMatches(portable, asset.refs ?? [], this.assets))
          throw new Error('MEDIA_HLS_REWRITE_INVALID');
        asset.manifest['sizeBytes'] = asset.offset;
        asset.manifest['sha256'] = asset.hash.digest('hex');
        const entry = this.entries.find(
          (candidate) => candidate.assetId === asset.id
        );
        if (!entry) throw new Error('MEDIA_ENTRY_MISSING');
        entry.sizeBytes = asset.offset;
        entry.sha256 = String(asset.manifest['sha256']);
        entry.sourceSha256 = asset.sourceSha256;
        entry.sourceSizeBytes = asset.sourceSizeBytes;
      }
      if (this.options.signal?.aborted) throw new Error('MEDIA_ABORTED');
      return [...this.entries];
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  cleanup(): Promise<void> {
    if (this.cleanupPromise) return this.cleanupPromise;
    this.closed = true;
    this.cleanupPromise = (async () => {
      const errors: unknown[] = [];
      for (const asset of this.assets.values()) {
        try {
          await this.closeAsset(asset);
        } catch (error) {
          errors.push(error);
        }
      }
      for (const entry of this.entries) {
        try {
          await entry.cleanup();
        } catch (error) {
          errors.push(error);
        }
      }
      if (this.privateRoot) {
        try {
          if ((await readdir(this.privateRoot)).length === 0)
            await rmdir(this.privateRoot);
          else errors.push(new Error('MEDIA_PRIVATE_DIRECTORY_NOT_EMPTY'));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
            errors.push(error);
        }
      }
      if (errors.length)
        throw new Error(`MEDIA_CLEANUP_FAILED: ${String(errors[0])}`);
    })();
    return this.cleanupPromise;
  }

  private async ensurePrivateRoot(): Promise<string> {
    if (this.privateRoot) return this.privateRoot;
    try {
      await mkdir(this.options.root, { recursive: true, mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const rootInfo = await lstat(this.options.root);
    if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory())
      throw new Error('MEDIA_ROOT_INVALID');
    this.privateRoot = join(
      this.options.root,
      `.account-export-media-${randomUUID()}`
    );
    await mkdir(this.privateRoot, { mode: 0o700 });
    return this.privateRoot;
  }

  private async acceptBytes(data: Record<string, unknown>): Promise<void> {
    const id = this.uuid(data['assetId']);
    const profile = this.uuid(data['profileId']);
    if (
      typeof data['id'] !== 'string' ||
      data['id'] !==
        `${profile}:${id}:${String(data['offset']).padStart(12, '0')}`
    )
      throw new Error('MEDIA_RECORD_INVALID');
    const offset = data['offset'];
    if (!Number.isSafeInteger(offset) || (offset as number) < 0)
      throw new Error('MEDIA_OFFSET_INVALID');
    const encoded = data['bytesBase64'];
    if (
      typeof encoded !== 'string' ||
      encoded.length < 4 ||
      encoded.length > MAX_BASE64 ||
      encoded.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        encoded
      )
    )
      throw new Error('MEDIA_BASE64_INVALID');
    const bytes = Buffer.from(encoded, 'base64');
    if (
      bytes.length < 1 ||
      bytes.length > MAX_CHUNK ||
      bytes.toString('base64') !== encoded
    )
      throw new Error('MEDIA_CHUNK_INVALID');
    if (this.profiles.has(id) && this.profiles.get(id) !== profile)
      throw new Error('MEDIA_PROFILE_MISMATCH');
    let asset = this.assets.get(id);
    if (!asset) {
      if (offset !== 0 || this.assets.size >= MAX_ASSETS)
        throw new Error('MEDIA_OFFSET_INVALID');
      if (this.options.signal?.aborted) throw new Error('MEDIA_ABORTED');
      const root = await this.ensurePrivateRoot();
      const path = join(root, randomUUID());
      const handle = await open(path, 'wx+', 0o600);
      // Keep only the descriptor: media bytes never have a directory entry.
      await unlink(path);
      asset = {
        id,
        profileId: profile,
        fileName: `${id}.pending`,
        handle,
        offset: 0,
        hash: createHash('sha256'),
      };
      this.profiles.set(id, profile);
      this.assets.set(id, asset);
    }
    if (
      asset.manifest ||
      asset.profileId !== profile ||
      asset.offset !== offset
    )
      throw new Error('MEDIA_OFFSET_INVALID');
    if (
      this.totalBytes + bytes.length > this.options.maxBytes ||
      this.totalBytes + bytes.length > MAX_TOTAL
    )
      throw new Error('MEDIA_BUDGET_EXCEEDED');
    if (this.options.signal?.aborted) throw new Error('MEDIA_ABORTED');
    let written = 0;
    while (written < bytes.length) {
      const result = await asset.handle.write(
        bytes,
        written,
        bytes.length - written,
        asset.offset + written
      );
      if (!result.bytesWritten) throw new Error('MEDIA_WRITE_FAILED');
      written += result.bytesWritten;
    }
    asset.hash.update(bytes);
    asset.offset += bytes.length;
    this.totalBytes += bytes.length;
    const prefix = Buffer.alloc(Math.min(1024, asset.offset));
    const read = await asset.handle.read(prefix, 0, prefix.length, 0);
    asset.mime = sniff(prefix.subarray(0, read.bytesRead));
  }

  private async acceptManifest(data: Record<string, unknown>): Promise<void> {
    const id = this.uuid(data['assetId']);
    const profile = this.uuid(data['profileId']);
    if (
      typeof data['id'] !== 'string' ||
      data['id'] !== `${profile}:${id}:manifest`
    )
      throw new Error('MEDIA_RECORD_INVALID');
    const asset = this.assets.get(id);
    if (!asset || asset.manifest || asset.profileId !== profile)
      throw new Error('MEDIA_MANIFEST_INVALID');
    if (
      !Number.isSafeInteger(data['sizeBytes']) ||
      data['sizeBytes'] !== asset.offset ||
      data['sizeBytes'] < 1 ||
      !asset.mime
    )
      throw new Error('MEDIA_SIZE_MISMATCH');
    if (
      data['mimeType'] !== asset.mime.mimeType ||
      data['fileName'] !== `${id}${asset.mime.extension}` ||
      typeof data['fileName'] !== 'string' ||
      data['fileName'].includes('/') ||
      data['fileName'].includes('\\')
    )
      throw new Error('MEDIA_METADATA_INVALID');
    const sha256 = asset.hash.digest('hex');
    if (data['sha256'] !== sha256) throw new Error('MEDIA_HASH_MISMATCH');
    if (
      data['validation'] !== 'signature' &&
      data['validation'] !== 'signature-and-owned-hls-references'
    )
      throw new Error('MEDIA_VALIDATION_INVALID');
    if (asset.mime.extension === '.m3u8') {
      if (
        data['validation'] !== 'signature-and-owned-hls-references' ||
        asset.offset > ACCOUNT_EXPORT_HLS_LIMITS.manifestBytes
      )
        throw new Error('MEDIA_HLS_INVALID');
      const content = await readAll(asset.handle, asset.offset);
      const refs = [
        ...parseAccountExportHlsPlaylist(content).referenceAssetIds,
      ];
      if (
        !Array.isArray(data['hlsReferenceAssetIds']) ||
        JSON.stringify(data['hlsReferenceAssetIds']) !== JSON.stringify(refs)
      )
        throw new Error('MEDIA_HLS_REFERENCE_MISMATCH');
      asset.refs = refs;
    } else if (
      data['hlsReferenceAssetIds'] !== undefined ||
      data['validation'] !== 'signature'
    )
      throw new Error('MEDIA_METADATA_INVALID');
    asset.fileName = `${id}${asset.mime.extension}`;
    asset.manifest = { ...data };
    const entry: AccountExportArtifactMediaEntry = {
      assetId: id,
      fileName: asset.fileName,
      mimeType: asset.mime.mimeType,
      sizeBytes: asset.offset,
      sha256,
      ...(asset.refs ? { hlsReferenceAssetIds: [...asset.refs] } : {}),
      createReadStream: () => {
        if (this.closed) throw new Error('MEDIA_CLOSED');
        return asset.handle.createReadStream({
          start: 0,
          end: asset.offset - 1,
          autoClose: false,
        });
      },
      cleanup: async () => {
        await this.closeAsset(asset);
      },
    };
    this.entries.push(entry);
  }

  private async closeAsset(asset: AssetState): Promise<void> {
    if (asset.closed) return;
    asset.closed = true;
    await asset.handle.close();
  }
  private uuid(value: unknown): string {
    if (typeof value !== 'string' || !UUID.test(value))
      throw new Error('MEDIA_UUID_INVALID');
    return value.toLowerCase();
  }
  private checkOpen(): void {
    if (this.closed || this.finished) throw new Error('MEDIA_COLLECTOR_CLOSED');
    if (this.options.signal?.aborted) throw new Error('MEDIA_ABORTED');
  }
}

async function readAll(handle: FileHandle, size: number): Promise<Buffer> {
  const bytes = Buffer.alloc(size);
  let read = 0;
  while (read < size) {
    const result = await handle.read(bytes, read, size - read, read);
    if (!result.bytesRead) throw new Error('MEDIA_READ_FAILED');
    read += result.bytesRead;
  }
  return bytes;
}

function portablePlaylistMatches(
  bytes: Buffer,
  refs: string[],
  assets: Map<string, AssetState>
): boolean {
  const text = bytes.toString('utf8');
  const lines = text.split('\n');
  if (lines.pop() !== '' || lines[0] !== '#EXTM3U') return false;
  const expected = new Set(
    refs
      .map((id) => assets.get(id)?.fileName)
      .filter((name): name is string => !!name)
  );
  const observed = lines.filter((line) => !line.startsWith('#'));
  return (
    observed.length === refs.length &&
    observed.every((name) => expected.has(name))
  );
}

function sniff(bytes: Buffer): Mime | undefined {
  const starts = (signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mimeType: 'image/png', extension: '.png' };
  if (starts([0xff, 0xd8, 0xff]))
    return { mimeType: 'image/jpeg', extension: '.jpg' };
  if (bytes.toString('ascii', 0, 7) === '#EXTM3U')
    return { mimeType: 'application/vnd.apple.mpegurl', extension: '.m3u8' };
  if (
    bytes.length >= 564 &&
    bytes[0] === 0x47 &&
    bytes[188] === 0x47 &&
    bytes[376] === 0x47
  )
    return { mimeType: 'video/mp2t', extension: '.ts' };
  if (/^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6)))
    return { mimeType: 'image/gif', extension: '.gif' };
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    return { mimeType: 'image/webp', extension: '.webp' };
  if (bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp') {
    const brand = bytes.toString('ascii', 8, 12);
    if (brand === 'qt  ')
      return { mimeType: 'video/quicktime', extension: '.mov' };
    if (
      [
        'isom',
        'iso2',
        'iso3',
        'iso4',
        'iso5',
        'iso6',
        'mp41',
        'mp42',
        'avc1',
        'M4V ',
        'dash',
        'MSNV',
      ].includes(brand)
    )
      return { mimeType: 'video/mp4', extension: '.mp4' };
  }
  if (
    bytes.length >= 8 &&
    starts([0x1a, 0x45, 0xdf, 0xa3]) &&
    bytes.includes(Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]))
  )
    return { mimeType: 'video/webm', extension: '.webm' };
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WAVE'
  )
    return { mimeType: 'audio/wav', extension: '.wav' };
  if (bytes.toString('ascii', 0, 4) === 'OggS')
    return { mimeType: 'audio/ogg', extension: '.ogg' };
  if (
    bytes.toString('ascii', 0, 3) === 'ID3' ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  )
    return { mimeType: 'audio/mpeg', extension: '.mp3' };
  if (bytes.toString('ascii', 0, 5) === '%PDF-')
    return { mimeType: 'application/pdf', extension: '.pdf' };
  return undefined;
}
