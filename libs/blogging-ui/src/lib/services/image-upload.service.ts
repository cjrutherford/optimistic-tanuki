import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, CreateAssetDto } from '@optimistic-tanuki/ui-models';

export interface AssetDto {
  id: string;
  name: string;
  profileId: string;
  type: string;
  storageStrategy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type AssetType = 'image' | 'video' | 'audio' | 'document';

/**
 * Service for uploading images/files to the Assets service
 */
@Injectable({
  providedIn: 'root',
})
export class ImageUploadService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /**
   * Uploads a file to the Assets service and returns the asset URL
   * @param file The file to upload
   * @param profileId The profile ID of the owner
   * @param fileName Optional custom filename
   * @returns Promise resolving to the asset URL
   */
  async uploadFile(
    file: File,
    profileId: string,
    fileName?: string
  ): Promise<string> {
    // Read file as base64
    const base64Content = await this.fileToBase64(file);
    
    // Extract file extension
    const fileExtension = this.getFileExtension(file.name);
    
    // Determine asset type from MIME type
    const assetType = this.getAssetType(file.type);
    
    // Create asset DTO
    const assetDto: CreateAssetDto = {
      name: fileName || file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      profileId: profileId,
      type: assetType,
      content: base64Content,
      fileExtension: fileExtension,
    };
    
    // Upload to asset service
    const asset = await firstValueFrom(
      this.http.post<AssetDto>(`${this.apiBaseUrl}/asset`, assetDto)
    );
    
    // Return the URL to access the asset
    return `${this.apiBaseUrl}/asset/${asset.id}`;
  }

  /**
   * Uploads a base64 data URL to the Assets service and returns the asset URL
   * @param dataUrl The base64 data URL
   * @param profileId The profile ID of the owner
   * @param fileName Optional custom filename
   * @returns Promise resolving to the asset URL
   */
  async uploadBase64(
    dataUrl: string,
    profileId: string,
    fileName?: string
  ): Promise<string> {
    // Extract file extension from data URL
    const fileExtension = this.getFileExtensionFromDataUrl(dataUrl);
    
    // Determine asset type from MIME type in data URL
    const mimeType = this.getMimeTypeFromDataUrl(dataUrl);
    const assetType = this.getAssetType(mimeType);
    
    // Create asset DTO
    const assetDto: CreateAssetDto = {
      name: fileName || `upload-${Date.now()}`,
      profileId: profileId,
      type: assetType,
      content: dataUrl,
      fileExtension: fileExtension,
    };
    
    // Upload to asset service
    const asset = await firstValueFrom(
      this.http.post<AssetDto>(`${this.apiBaseUrl}/asset`, assetDto)
    );
    
    // Return the URL to access the asset
    return `${this.apiBaseUrl}/asset/${asset.id}`;
  }

  /**
   * Converts a File to base64 string
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Extracts file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'png';
  }

  /**
   * Extracts file extension from data URL
   */
  private getFileExtensionFromDataUrl(dataUrl: string): string {
    const mimeType = this.getMimeTypeFromDataUrl(dataUrl);
    const extensionMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'video/mp4': 'mp4',
      'video/mpeg': 'mpeg',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'application/pdf': 'pdf',
    };
    return extensionMap[mimeType] || 'png';
  }

  /**
   * Extracts MIME type from data URL
   */
  private getMimeTypeFromDataUrl(dataUrl: string): string {
    const match = dataUrl.match(/^data:(.+?);base64,/);
    return match ? match[1] : 'image/png';
  }

  /**
   * Determines AssetType from MIME type
   */
  private getAssetType(mimeType: string): AssetType {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (mimeType.startsWith('audio/')) {
      return 'audio';
    } else {
      return 'document';
    }
  }
}
