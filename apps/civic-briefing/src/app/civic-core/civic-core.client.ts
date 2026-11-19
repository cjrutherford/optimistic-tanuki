import type { ClientProxy } from '@nestjs/microservices';
import {
  CIVIC_GET_AGENDAS,
  CIVIC_GET_BROADCASTS,
  CIVIC_GET_OFFICIALS,
  CIVIC_GET_TENANTS,
  CIVIC_GET_TIP_PROJECTS,
} from '@optimistic-tanuki/constants';
import type {
  CivicAgendaRecord,
  CivicBroadcastRecord,
  CivicCoreClient,
  CivicTenantRecord,
  CivicTipProjectRecord,
} from '@optimistic-tanuki/civic-adapters';
import { firstValueFrom, timeout } from 'rxjs';

/** One town's officials as `civic.get_officials` serves them. */
export interface CivicTownOfficials {
  tenantId: string;
  townName: string;
  state: string;
  kind: CivicTenantRecord['kind'];
  officials: {
    name: string;
    role: string;
    sourceAgendaId: string | null;
    firstSeen: string;
    lastSeen: string;
  }[];
}

export const DEFAULT_CIVIC_TIMEOUT_MS = 15_000;

/** Civic Core's address, from the environment (CIVIC_HOST, CIVIC_PORT). */
export function civicCoreEndpoint(
  env: Record<string, string | undefined> = process.env
): { host: string; port: number } {
  const port = Number(env['CIVIC_PORT']);
  return {
    host: env['CIVIC_HOST'] || 'civic',
    port: Number.isInteger(port) && port > 0 ? port : 3026,
  };
}

/**
 * Reads Civic Core (`apps/civic`) over TCP with its existing message
 * patterns. Reads only; a failure or a timeout rejects, and the adapter or
 * the adoption step decides what that costs.
 */
export class TcpCivicCoreClient implements CivicCoreClient {
  constructor(
    private readonly proxy: Pick<ClientProxy, 'send'>,
    private readonly timeoutMs: number = DEFAULT_CIVIC_TIMEOUT_MS
  ) {}

  tenants(): Promise<CivicTenantRecord[]> {
    return this.send(CIVIC_GET_TENANTS, {});
  }

  agendas(
    tenantId: string,
    opts: { limit?: number } = {}
  ): Promise<CivicAgendaRecord[]> {
    return this.send(CIVIC_GET_AGENDAS, { tenantId, ...opts });
  }

  broadcasts(
    tenantId: string,
    opts: { since?: string; limit?: number } = {}
  ): Promise<CivicBroadcastRecord[]> {
    return this.send(CIVIC_GET_BROADCASTS, { tenantId, ...opts });
  }

  tipProjects(tenantId: string): Promise<CivicTipProjectRecord[]> {
    return this.send(CIVIC_GET_TIP_PROJECTS, { tenantId });
  }

  /** Officials Civic Core read from agendas, per town (D33). */
  officials(): Promise<CivicTownOfficials[]> {
    return this.send(CIVIC_GET_OFFICIALS, {});
  }

  private async send<T>(pattern: string, payload: unknown): Promise<T[]> {
    const reply = await firstValueFrom(
      this.proxy.send<T[]>(pattern, payload).pipe(timeout(this.timeoutMs))
    );
    return Array.isArray(reply) ? reply : [];
  }
}
