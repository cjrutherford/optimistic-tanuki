import { Logger } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { CivicOfficial } from '../entities/civic-official.entity';
import { CivicTenant } from '../entities/civic-tenant.entity';
import {
  extractOfficials,
  normalizeOfficialName,
} from './officials-extraction';

/** Officials not named by an agenda for this long are no longer served. */
export const OFFICIALS_MAX_AGE_MONTHS = 12;

export interface CivicOfficialRecord {
  name: string;
  role: string;
  sourceAgendaId: string | null;
  firstSeen: string;
  lastSeen: string;
}

export interface CivicTownOfficials {
  tenantId: string;
  townName: string;
  /** Two-letter state code. */
  state: string;
  kind: string;
  officials: CivicOfficialRecord[];
}

/** Stores the officials agendas name, and serves the recent ones per town. */
export class CivicOfficialsService {
  private readonly logger = new Logger(CivicOfficialsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly now: () => Date = () => new Date()
  ) {}

  private get officials(): Repository<CivicOfficial> {
    return this.dataSource.getRepository(CivicOfficial);
  }

  /**
   * Records the officials named in an agenda's text. `seenAt` is the meeting
   * date, so a re-import of an old agenda does not make anyone look current.
   * Never throws: a failed extraction must not fail the ingest.
   */
  async record(
    tenantId: string,
    agendaId: string,
    text: string,
    seenAt: Date
  ): Promise<number> {
    try {
      const found = extractOfficials(text);
      for (const official of found) {
        const normalizedName = normalizeOfficialName(official.name);
        const existing = await this.officials.findOneBy({
          tenantId,
          normalizedName,
        });
        if (!existing) {
          await this.officials.insert({
            tenantId,
            name: official.name,
            normalizedName,
            role: official.role,
            sourceAgendaId: agendaId,
            firstSeen: seenAt,
            lastSeen: seenAt,
          });
          continue;
        }
        const newer = seenAt.getTime() >= existing.lastSeen.getTime();
        await this.officials.update(
          { id: existing.id },
          {
            firstSeen:
              seenAt.getTime() < existing.firstSeen.getTime()
                ? seenAt
                : existing.firstSeen,
            ...(newer
              ? {
                  lastSeen: seenAt,
                  role: official.role,
                  name: official.name,
                  sourceAgendaId: agendaId,
                }
              : {}),
          }
        );
      }
      return found.length;
    } catch (error) {
      this.logger.warn(
        `Could not record officials for agenda ${agendaId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 0;
    }
  }

  /** Officials seen in the last 12 months, per registered town; `town` limits it to one tenant. */
  async list(town?: string): Promise<CivicTownOfficials[]> {
    const cutoff = this.now();
    cutoff.setMonth(cutoff.getMonth() - OFFICIALS_MAX_AGE_MONTHS);
    const tenants = await this.dataSource.getRepository(CivicTenant).find({
      where: town ? { id: town } : {},
      order: { id: 'ASC' },
    });
    const rows = (
      await this.officials.find({
        where: town ? { tenantId: town } : {},
        order: { tenantId: 'ASC', role: 'ASC', name: 'ASC' },
      })
    ).filter((row) => row.lastSeen.getTime() >= cutoff.getTime());
    const result: CivicTownOfficials[] = [];
    for (const tenant of tenants) {
      const officials = rows
        .filter((row) => row.tenantId === tenant.id)
        .map((row) => ({
          name: row.name,
          role: row.role,
          sourceAgendaId: row.sourceAgendaId,
          firstSeen: row.firstSeen.toISOString(),
          lastSeen: row.lastSeen.toISOString(),
        }));
      if (officials.length === 0) continue;
      result.push({
        tenantId: tenant.id,
        townName: tenant.townName,
        state: tenant.state,
        kind: tenant.kind,
        officials,
      });
    }
    return result;
  }
}
