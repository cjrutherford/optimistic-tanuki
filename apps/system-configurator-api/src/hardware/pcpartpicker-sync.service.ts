import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HardwarePartEntity } from './entities/hardware-part.entity';

type ParsedPart = {
  slug: string;
  name: string;
  price: number;
  sourceUrl: string;
  vendor: string | null;
  specs: Record<string, string>;
};

@Injectable()
export class PcPartPickerSyncService {
  private readonly logger = new Logger(PcPartPickerSyncService.name);
  private readonly categoryPaths = {
    cpu: '/products/cpu/',
    ram: '/products/memory/',
    storage: '/products/internal-hard-drive/',
    gpu: '/products/video-card/',
  } as const;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(HardwarePartEntity)
    private readonly partRepository: Repository<HardwarePartEntity>
  ) {}

  async syncCatalog(): Promise<void> {
    for (const category of ['cpu', 'ram', 'storage', 'gpu'] as const) {
      try {
        const parsed = await this.fetchCategory(category);
        await this.upsertCategory(category, parsed);
      } catch (error) {
        this.logger.warn(
          `PCPartPicker sync failed for ${category}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  private async fetchCategory(
    category: 'cpu' | 'ram' | 'storage' | 'gpu'
  ): Promise<ParsedPart[]> {
    const baseUrl =
      this.configService.get<string>('pcpartpicker.baseUrl') ||
      'https://pcpartpicker.com';
    const response = await fetch(
      `${baseUrl.replace(/\/$/, '')}${this.categoryPaths[category]}`,
      {
        headers: {
          'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return this.extractProducts(html).slice(0, 36);
  }

  private extractProducts(html: string): ParsedPart[] {
    const products = new Map<string, ParsedPart>();
    const productRegex =
      /href="(\/product\/[^"]+)"[^>]*>([^<]{4,200})<\/a>/g;
    let match: RegExpExecArray | null;

    while ((match = productRegex.exec(html)) !== null) {
      const rawUrl = match[1];
      const rawName = match[2]?.replace(/\s+/g, ' ').trim();
      if (!rawUrl || !rawName) {
        continue;
      }

      const windowStart = Math.max(0, match.index - 120);
      const windowEnd = Math.min(html.length, match.index + 420);
      const snippet = html.slice(windowStart, windowEnd);
      const priceMatch = snippet.match(/\$([0-9,]+(?:\.[0-9]{2})?)/);
      const price = priceMatch
        ? Number(priceMatch[1].replace(/,/g, ''))
        : Number.NaN;

      if (!Number.isFinite(price)) {
        continue;
      }

      const baseUrl =
        this.configService.get<string>('pcpartpicker.baseUrl') ||
        'https://pcpartpicker.com';
      const sourceUrl = `${baseUrl.replace(/\/$/, '')}${rawUrl}`;
      const slug = rawUrl
        .replace(/^\/product\//, '')
        .replace(/[/?#].*$/, '')
        .replace(/[^a-zA-Z0-9-]+/g, '-')
        .toLowerCase();

      products.set(sourceUrl, {
        slug,
        name: rawName,
        price,
        sourceUrl,
        vendor: rawName.split(' ')[0] || null,
        specs: {},
      });
    }

    return [...products.values()];
  }

  private async upsertCategory(
    category: 'cpu' | 'ram' | 'storage' | 'gpu',
    parsed: ParsedPart[]
  ): Promise<void> {
    if (!parsed.length) {
      return;
    }

    const chassisByTier: Record<string, string[]> = {
      xs: ['xs-cloud', 'xs-dev', 'xs-nas'],
      s: ['s-cloud', 's-nas'],
      m: ['m-cloud', 'm-nas'],
      l: ['l-cloud', 'l-nas'],
    };

    const sorted = [...parsed].sort((a, b) => a.price - b.price);
    const buckets = {
      xs: sorted.slice(0, 4),
      s: sorted.slice(4, 10),
      m: sorted.slice(10, 18),
      l: sorted.slice(18, 26),
    };

    for (const [tier, items] of Object.entries(buckets)) {
      for (const item of items) {
        const slug = `pcpp-${tier}-${category}-${item.slug}`;
        await this.partRepository.upsert(
          {
            slug,
            category,
            vendor: item.vendor,
            name: item.name,
            description: `Imported from PCPartPicker for ${tier.toUpperCase()} tier ${category} options.`,
            basePrice: item.price,
            sellingPrice: item.price,
            specs: item.specs,
            compatibleChassisSlugs: chassisByTier[tier],
            inStock: true,
            isActive: true,
            sourceType: 'pcpartpicker',
            externalSource: 'pcpartpicker',
            externalId: item.slug,
            sourceUrl: item.sourceUrl,
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
          },
          ['slug']
        );
      }
    }
  }
}
