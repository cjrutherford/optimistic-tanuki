import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CASE_OPTION_SEED,
  CHASSIS_SEED,
  PART_SEED,
} from './catalog.seed';
import { CaseOptionEntity } from './entities/case-option.entity';
import { ChassisEntity } from './entities/chassis.entity';
import { HardwarePartEntity } from './entities/hardware-part.entity';
import { PcPartPickerSyncService } from './pcpartpicker-sync.service';

@Injectable()
export class CatalogBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(CatalogBootstrapService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly syncService: PcPartPickerSyncService,
    @InjectRepository(ChassisEntity)
    private readonly chassisRepository: Repository<ChassisEntity>,
    @InjectRepository(CaseOptionEntity)
    private readonly caseOptionRepository: Repository<CaseOptionEntity>,
    @InjectRepository(HardwarePartEntity)
    private readonly partRepository: Repository<HardwarePartEntity>
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedCatalog();
    await this.runSyncIfEnabled();
  }

  private async seedCatalog(): Promise<void> {
    for (const chassis of CHASSIS_SEED) {
      await this.chassisRepository.upsert(
        {
          ...chassis,
          sourceType: 'research',
        },
        ['slug']
      );
    }

    for (const option of CASE_OPTION_SEED) {
      await this.caseOptionRepository.upsert(
        {
          chassisSlug: option.chassisSlug,
          title: option.title,
          optionType: option.optionType,
          vendor: option.vendor || null,
          sourceName: option.sourceName,
          sourceUrl: option.sourceUrl,
          priceLabel: option.priceLabel,
          priceMin: option.priceMin ?? null,
          priceMax: option.priceMax ?? null,
          features: option.features,
          isRecommended: option.isRecommended ?? false,
          sourceType: option.optionType === 'printable' ? 'curated' : 'research',
        },
        ['chassisSlug', 'title']
      );
    }

    for (const part of PART_SEED) {
      await this.partRepository.upsert(
        {
          ...part,
          vendor: part.vendor || null,
          sourceType: part.sourceType || 'curated',
          externalSource: null,
          externalId: null,
          sourceUrl: null,
          lastSyncedAt: null,
          syncStatus: 'seeded',
          inStock: true,
          isActive: true,
        },
        ['slug']
      );
    }
  }

  private async runSyncIfEnabled(): Promise<void> {
    const syncOnStart = Boolean(
      this.configService.get<boolean>('pcpartpicker.syncOnStart')
    );
    if (syncOnStart) {
      await this.syncService.syncCatalog();
    }

    const syncIntervalMs =
      this.configService.get<number>('pcpartpicker.syncIntervalMs') || 0;
    if (syncIntervalMs > 0) {
      setInterval(() => {
        void this.syncService.syncCatalog().catch((error) => {
          this.logger.warn(
            `Scheduled PCPartPicker sync failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        });
      }, syncIntervalMs);
    }
  }
}
