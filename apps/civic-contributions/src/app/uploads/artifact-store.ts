import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AssetType } from '@optimistic-tanuki/models';
import {
  LocalStorageAdapter,
  VirusScanService,
  type VirusScanResult,
} from '@optimistic-tanuki/storage';
import { COMMUNITY_CONFIG, type CommunityConfig } from '../../config';
import { ArtifactEntity } from '../entities';
import { ACCEPTED_DESCRIPTION, detectMediaType } from './media-type';

/**
 * Uploads: scanned, identified by their bytes, then stored — in that order,
 * so every byte uploaded is scanned, whatever it claims to be, and nothing
 * unscanned or unaccepted ever reaches storage.
 *
 * Storage is upstream's local block-storage adapter, behind upstream's
 * StorageAdapter interface, so the destination's assets service can take its
 * place. The adapter builds its path from the asset's name, so the name is
 * always ours (the content hash and the detected extension), never the
 * uploader's: a name like "../../x" never reaches it. Files are
 * content-addressed: the same bytes submitted twice are one artifact.
 */

export type AcceptResult =
  | { artifact: ArtifactEntity; describe: string }
  | { refused: string };

@Injectable()
export class ArtifactStore implements OnModuleInit {
  private readonly logger = new Logger(ArtifactStore.name);
  private storage: LocalStorageAdapter;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(COMMUNITY_CONFIG) private readonly config: CommunityConfig,
    private readonly scanner: VirusScanService
  ) {}

  onModuleInit(): void {
    if (!this.scanner.isConfigured()) {
      this.logger.warn(
        'CLAMAV_HOST is not set: no virus scanner is configured, so every upload will be refused.'
      );
    }
    this.storage = new LocalStorageAdapter(
      new Logger('LocalStorageAdapter'),
      this.config.artifactRoot
    );
  }

  async accept(
    attachment: { name: string; base64: string },
    contributorId: string
  ): Promise<AcceptResult> {
    if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(attachment.base64))
      return {
        refused:
          'The attachment did not arrive intact. Try uploading it again.',
      };
    const content = Buffer.from(attachment.base64, 'base64');
    if (content.length === 0) return { refused: 'The attachment is empty.' };
    if (content.length > this.config.maxUploadBytes) {
      return {
        refused: `The attachment is ${(content.length / 1_048_576).toFixed(
          1
        )} MB; the most accepted is ${(
          this.config.maxUploadBytes / 1_048_576
        ).toFixed(0)} MB.`,
      };
    }
    // The platform scanner fails closed: it throws when it cannot reach
    // clamd, so a scan that did not happen is never taken as one that passed.
    let verdict: VirusScanResult;
    try {
      verdict = await this.scanner.scanFile(content, attachment.name);
    } catch (error) {
      this.logger.warn(
        `upload refused for contributor ${contributorId}: scan did not complete (${
          error instanceof Error ? error.message : String(error)
        })`
      );
      return {
        refused:
          'Uploads cannot be checked for viruses right now, so none are being accepted. Try again later, or link to the file instead.',
      };
    }
    if (!verdict.isClean) {
      this.logger.warn(
        `upload refused for contributor ${contributorId}: ${
          (verdict.threats ?? []).join(', ') || 'threat found'
        }`
      );
      return {
        refused:
          'The attachment was refused: the virus scanner found a threat in it.',
      };
    }

    const type = detectMediaType(content);
    if (!type)
      return {
        refused: `That file type is not accepted. Attach ${ACCEPTED_DESCRIPTION}.`,
      };

    const sha256 = createHash('sha256').update(content).digest('hex');
    const repository = this.db.getRepository(ArtifactEntity);
    const existing = await repository.findOneBy({ sha256 });
    if (existing) return { artifact: existing, describe: type.describe };

    const asset = await this.storage.create({
      name: `${sha256}.${type.extension}`,
      profileId: contributorId,
      type: assetType(type.mediaType),
      content,
    });
    const artifact = await repository.save(
      repository.create({
        sha256,
        mediaType: type.mediaType,
        bytes: content.length,
        storagePath: asset.storagePath,
        scanner: verdict.scanner,
        scannedAt: new Date(),
        firstContributorId: contributorId,
      })
    );
    return { artifact, describe: type.describe };
  }
}

function assetType(mediaType: string): AssetType {
  if (mediaType.startsWith('image/')) return AssetType.IMAGE;
  if (mediaType.startsWith('audio/')) return AssetType.AUDIO;
  return AssetType.DOCUMENT;
}
