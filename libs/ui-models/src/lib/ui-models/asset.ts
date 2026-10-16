export interface AssetAudienceRestriction {
  type: 'owner' | 'followers' | 'community' | 'guardian-staged';
  profileId: string;
  communityId?: string;
  appId?: string;
}

export const ASSET_UPLOAD_LIMIT_BYTES: Record<CreateAssetDto['type'], number> =
  {
    image: 20 * 1024 * 1024,
    document: 25 * 1024 * 1024,
    video: 25 * 1024 * 1024,
    audio: 20 * 1024 * 1024,
  };

export function assertAssetUploadSize(
  sizeBytes: number,
  type: CreateAssetDto['type']
): void {
  const maxBytes = ASSET_UPLOAD_LIMIT_BYTES[type];
  if (sizeBytes > maxBytes) {
    throw new Error(
      `This ${type} upload exceeds the ${Math.floor(
        maxBytes / (1024 * 1024)
      )} MiB limit. Choose a smaller file.`
    );
  }
}

export function estimateBase64Bytes(value: string): number {
  const separator = value.startsWith('data:') ? value.indexOf(',') : -1;
  const encoded = separator >= 0 ? value.slice(separator + 1) : value;
  return Math.max(
    0,
    Math.floor((encoded.length * 3) / 4) -
      (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0)
  );
}

export interface CreateAssetDto {
  name: string;
  profileId: string;
  type: 'image' | 'video' | 'audio' | 'document';
  content?: string; // Optional content for in-memory operations
  fileExtension?: string; // Optional file extension for in-memory operations
  audienceRestrictions?: AssetAudienceRestriction[];
}

export declare type AssetDto = {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document';
  storageStrategy:
    | 'local_block_storage'
    | 'remote_block_storage'
    | 'database_storage';
  storagePath: string;
  profileId: string;
  content?: string; // Optional content for in-memory operations
};
