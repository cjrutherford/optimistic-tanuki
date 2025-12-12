import { Injectable } from '@angular/core';

/**
 * Service to handle image extraction and replacement in TipTap editor content
 */
@Injectable()
export class ImageUploadService {
  /**
   * Extract all base64 images from HTML content
   * Returns an array of { original, dataUrl }
   */
  extractBase64Images(htmlContent: string): Array<{ original: string; dataUrl: string }> {
    const images: Array<{ original: string; dataUrl: string }> = [];
    const imgRegex = /<img[^>]+src="(data:image\/[^;]+;base64,[^"]+)"[^>]*>/g;
    let match;

    while ((match = imgRegex.exec(htmlContent)) !== null) {
      images.push({
        original: match[0], // Full img tag
        dataUrl: match[1],  // Data URL
      });
    }

    return images;
  }

  /**
   * Replace base64 image data URLs with asset URLs in HTML content
   */
  replaceImageUrls(
    htmlContent: string,
    replacements: Array<{ dataUrl: string; assetUrl: string }>
  ): string {
    let updatedContent = htmlContent;

    replacements.forEach(({ dataUrl, assetUrl }) => {
      // Replace all occurrences of the data URL with the asset URL
      updatedContent = updatedContent.replace(
        new RegExp(this.escapeRegex(dataUrl), 'g'),
        assetUrl
      );
    });

    return updatedContent;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  /**
   * Get MIME type from data URL
   */
  getMimeTypeFromDataUrl(dataUrl: string): string {
    return dataUrl.split(',')[0].match(/:(.*?);/)?.[1] || 'image/png';
  }
}
