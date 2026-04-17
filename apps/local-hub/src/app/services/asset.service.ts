import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

export interface AssetDto {
  id: string;
  name: string;
  profileId: string;
  type: string;
  storageStrategy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAssetDto {
  name: string;
  profileId: string;
  type: string;
  content: string;
  fileExtension: string;
}

@Injectable({
  providedIn: 'root',
})
export class AssetService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly baseUrl = `${this.apiBaseUrl}/asset`;

  createAsset(dto: CreateAssetDto): Promise<AssetDto> {
    return firstValueFrom(this.http.post<AssetDto>(this.baseUrl, dto));
  }

  getAssetUrl(id: string): string {
    return `${this.baseUrl}/${id}`;
  }

  /** Convert a browser File to base64 data URL. */
  fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
