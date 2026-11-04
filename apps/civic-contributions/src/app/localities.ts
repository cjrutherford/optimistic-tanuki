import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
  createLocalityRegistry,
  type LocalityConfig,
  type LocalityRegistry,
} from '@optimistic-tanuki/civic-core';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import { CIVIC_BRIEFING_CLIENT } from './corpus.service';

/** The locality graph, asked of civic-briefing: which towns are editions, and each one's officials. */
export const LOCALITIES = Symbol('LOCALITIES');

/** How often the localities are asked for again, so towns synced after startup appear. */
export const LOCALITIES_REFRESH_MS = 15 * 60 * 1000;
/** Until the first reply, how soon it is asked for again. */
export const LOCALITIES_RETRY_MS = 10 * 1000;
const QUERY_TIMEOUT_MS = 30_000;

export interface Localities {
  find(slug: string): LocalityConfig | undefined;
  get(slug: string): LocalityConfig;
  /** The towns the pipeline publishes an edition for: what density is measured against. */
  editions(): string[];
}

type BriefingClient = Pick<ClientProxy, 'send'> &
  Partial<Pick<ClientProxy, 'close'>>;
type WarnLogger = Pick<Logger, 'warn' | 'log' | 'error'>;

/**
 * The localities civic-briefing serves over TCP (LIST_LOCALITIES). Until a
 * reply arrives the provider is empty: no town is known, so every submission
 * is refused as being for a town not covered, and the service still starts and
 * answers. A failed refresh keeps the last registry that loaded.
 */
@Injectable()
export class LocalitiesService
  implements Localities, OnModuleInit, OnApplicationShutdown
{
  private registry: LocalityRegistry | null = null;
  private timer: NodeJS.Timeout | null = null;
  private loadedAt = 0;

  constructor(
    @Inject(CIVIC_BRIEFING_CLIENT) private readonly briefing: BriefingClient,
    private readonly logger: WarnLogger = new Logger('Localities'),
    private readonly intervalMs = LOCALITIES_REFRESH_MS,
    private readonly retryMs = LOCALITIES_RETRY_MS,
    private readonly now: () => number = Date.now
  ) {}

  async onModuleInit(): Promise<void> {
    // Startup does not wait on, or fail with, civic-briefing.
    await this.refresh();
    // Ticks often enough to retry quickly while nothing has loaded, and
    // refreshes only once the interval has passed after that.
    this.timer = setInterval(() => {
      const due = this.registry
        ? this.now() - this.loadedAt >= this.intervalMs
        : true;
      if (due) void this.refresh();
    }, Math.min(this.retryMs, this.intervalMs));
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Asks civic-briefing for the localities. A failure is logged and the last registry kept. */
  async refresh(): Promise<void> {
    try {
      const localities = await firstValueFrom(
        this.briefing
          .send<LocalityConfig[]>(
            { cmd: CivicBriefingCommands.LIST_LOCALITIES },
            {}
          )
          .pipe(timeout(QUERY_TIMEOUT_MS))
      );
      this.registry = createLocalityRegistry(localities);
      this.loadedAt = this.now();
      this.logger.log(`${localities.length} localities loaded`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        this.registry
          ? `locality refresh failed, keeping the previous ${
              this.registry.all().length
            } localities: ${reason}`
          : `no localities are loaded (civic-briefing did not answer: ${reason}), so no town can be contributed to.`
      );
    }
  }

  find(slug: string): LocalityConfig | undefined {
    return this.registry?.all().find((locality) => locality.slug === slug);
  }

  get(slug: string): LocalityConfig {
    if (!this.registry) throw new Error(`unknown locality: ${slug}`);
    return this.registry.get(slug);
  }

  editions(): string[] {
    return this.registry?.editions().map((locality) => locality.slug) ?? [];
  }
}
