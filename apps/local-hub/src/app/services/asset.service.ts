import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  API_BASE_URL,
  assertAssetUploadSize,
  estimateBase64Bytes,
} from '@optimistic-tanuki/ui-models';

export interface AssetDto {
  id: string;
  name: string;
  profileId: string;
  type: 'image' | 'video' | 'audio' | 'document';
  storageStrategy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAssetDto {
  name: string;
  profileId: string;
  type: 'image' | 'video' | 'audio' | 'document';
  content: string;
  fileExtension: string;
  communityId?: string;
  classifiedAdId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AssetService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly baseUrl = `${this.apiBaseUrl}/asset`;

  createAsset(dto: CreateAssetDto): Promise<AssetDto> {
    assertAssetUploadSize(estimateBase64Bytes(dto.content), dto.type);
    return firstValueFrom(this.http.post<AssetDto>(this.baseUrl, dto));
  }

  getAssetUrl(id: string): string {
    return `${this.baseUrl}/${id}`;
  }

  /** Convert a browser File to base64 data URL. */
  fileToDataUrl(file: File): Promise<string> {
    assertAssetUploadSize(file.size, this.assetTypeForMime(file.type));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private assetTypeForMime(
    mimeType: string
  ): 'image' | 'video' | 'audio' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  /** Extract mime-to-extension mapping from a data URL. */
  getFileExtension(dataUrl: string): string {
    const mimeType = dataUrl.split(',')[0].match(/:(.*?);/)?.[1] ?? '';
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    return map[mimeType] ?? 'png';
  }
}
