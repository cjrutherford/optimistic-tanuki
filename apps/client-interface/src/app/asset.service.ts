import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { CreateAssetDto } from '@optimistic-tanuki/ui-models';

export interface AssetDto {
  id: string;
  name: string;
  profileId: string;
  type: string;
  storageStrategy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class AssetService {
  private baseUrl: string;

  constructor(
    @Inject(API_BASE_URL) private apiBaseUrl: string,
    private http: HttpClient
  ) {
    this.baseUrl = `${this.apiBaseUrl}/asset`;
  }

  /**
   * Upload an asset (image, file, etc.) to the asset service
   */
  createAsset(assetDto: CreateAssetDto): Observable<AssetDto> {
    return this.http.post<AssetDto>(this.baseUrl, assetDto);
  }

  /**
   * Get the URL to retrieve an asset by ID
   */
  getAssetUrl(id: string): string {
    return `${this.baseUrl}/${id}`;
  }

  /**
   * Delete an asset by ID
   */
  deleteAsset(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Convert a base64 data URL to a Blob
   */
  dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Extract file extension from data URL
   */
  getFileExtensionFromDataUrl(dataUrl: string): string {
    const mimeType = dataUrl.split(',')[0].match(/:(.*?);/)?.[1];
    const extensionMap: { [key: string]: string } = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };
    return extensionMap[mimeType || ''] || 'png';
  }
}
