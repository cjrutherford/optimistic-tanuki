import * as path from 'path';

import { AssetDto, CreateAssetDto } from '@optimistic-tanuki/models';
import { Injectable, Logger } from '@nestjs/common';
import { existsSync, promises as fs, mkdirSync } from 'fs';

import { StorageAdapter } from './storage-adapter.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
    constructor(private readonly l: Logger, private readonly basePath: string) { 
        this.l.log(`LocalStorageAdapter initialized with basePath: ${this.basePath}`);
        this.ensureBasePathExists();
    }

    private ensureBasePathExists(): void {
        if (!existsSync(this.basePath)) {
            mkdirSync(this.basePath, { recursive: true });
            this.l.log(`LocalStorageAdapter: Created basePath at ${this.basePath}`);
        }
    }

    async create(data: CreateAssetDto): Promise<AssetDto> {
        data.name = data.name.replace(/\s+/g, '_');
        console.log("🚀 ~ LocalStorageAdapter ~ create ~ data:", data)
        await this.ensureBasePathExists();
        this.l.log(`LocalStorageAdapter: Creating asset with data:`, data.name, data.profileId, data.type, data.content?.length);
        const assetId = uuidv4();
        // Create a unique path for the file within the base path
        const relativePath = path.join('assets', assetId, data.name);
        const absolutePath = path.join(this.basePath, relativePath);

        try {
            // Ensure the directory for the file exists
            await fs.mkdir(path.dirname(absolutePath), { recursive: true });

            // Write the file content (assuming data.content is available in CreateAssetDto)
            // You might need to adjust CreateAssetDto or how content is passed
            // For now, let's assume data has a 'content' property which is a Buffer
            if (!data.content) {
                 throw new Error('File content is missing in CreateAssetDto');
            }
            let buffer: Buffer;
            if(typeof data.content === 'string' && data.content.startsWith('data:')) {
                // Handle base64 encoded data URL
                const base64Data = data.content.split(',')[1];
                buffer = Buffer.from(base64Data, 'base64');
            } else if (Buffer.isBuffer(data.content)) {
                buffer = data.content;
            } else {
                throw new Error('Invalid content type in CreateAssetDto');
            }
            await fs.writeFile(absolutePath, new Uint8Array(buffer));

            const createdAsset: AssetDto = {
                id: assetId,
                name: data.name,
                storagePath: relativePath, // Store the relative path
                type: data.type, // Assuming type is in CreateAssetDto
                storageStrategy: 'local_block_storage',
                profileId: data.profileId, // Assuming profileId is in CreateAssetDto
            };

            this.l.log(`LocalStorageAdapter: Asset created at ${absolutePath}`);
            return createdAsset;

        } catch (error: any) {
            this.l.error(`LocalStorageAdapter: Failed to create asset: ${error.message}`);
            throw error; // Re-throw the error
        }        
    }

    async remove(data: AssetDto): Promise<void> {
        this.ensureBasePathExists();
        this.l.log(`LocalStorageAdapter: Removing asset with data:`, data);
        const absolutePath = path.join(this.basePath, data.storagePath);

        try {
            // Remove the file
            await fs.unlink(absolutePath);
            this.l.log(`LocalStorageAdapter: Asset removed from ${absolutePath}`);

            // Optional: Clean up empty directories
            // This can be complex, so might be done by a separate process or less aggressively
            // For simplicity, we won't add directory cleanup here.

        } catch (error: any) {
            // Ignore error if file doesn't exist
            if (error.code === 'ENOENT') {
                this.l.warn(`LocalStorageAdapter: Attempted to remove non-existent asset at ${absolutePath}`);
            } else {
                this.l.error(`LocalStorageAdapter: Failed to remove asset at ${absolutePath}: ${error.message}`);
                throw error; // Re-throw other errors
            }
        }
    }

    async retrieve(data: AssetDto): Promise<AssetDto> {
        this.ensureBasePathExists();
        this.l.log(`LocalStorageAdapter: Retrieving asset with data:`, data);
        // TODO: Implement actual local file retrieval logic using data.id or data.path
        // For now, return a mock AssetDto or null if not found
        const mockAsset: AssetDto = {
            id: data.id,
            name: 'mock-retrieved-name',
            storagePath: `/local/path/${data.id}`,
            type: 'image',
            storageStrategy: 'local_block_storage',
            profileId: ''
        };
        return mockAsset; // Return mock data
    }

    async read(data: AssetDto): Promise<string> {
        this.ensureBasePathExists();
        this.l.log(`LocalStorageAdapter: Reading asset with data:`, Object.entries(data).map(([key, value]) => `${key}: ${value}`).join(', '));
        const absolutePath = path.join(this.basePath, data.storagePath);

        try {
            // Read the file content
            const fileContent = await fs.readFile(absolutePath);
            this.l.log(`LocalStorageAdapter: Asset content read from ${absolutePath}: ${fileContent.length}`);
            const mime = this.getMimeType(data.type);
            const base64Content = `data:${mime};base64,${fileContent.toString('base64')}`;
            return base64Content;;
        } catch (error: any) {
            this.l.error(`LocalStorageAdapter: Failed to read asset content from ${absolutePath}: ${error.message}`);
            throw error; // Re-throw the error
        }
    }

    private getMimeType(type: string): string {
        switch (type) {
            case 'image':
                return 'image/png'; // Default to PNG for simplicity
            case 'video':
                return 'video/mp4'; // Default to MP4 for simplicity
            case 'audio':
                return 'audio/mpeg'; // Default to MP3 for simplicity
            case 'document':
                return 'application/pdf'; // Default to PDF for simplicity
            default:
                return 'application/octet-stream'; // Fallback for unknown types
        }
    }
}