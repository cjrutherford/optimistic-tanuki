import type { ClientProxy } from '@nestjs/microservices';
import {
  CIVIC_GET_AGENDAS,
  CIVIC_GET_BROADCASTS,
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

  private async send<T>(pattern: string, payload: unknown): Promise<T[]> {
    const reply = await firstValueFrom(
      this.proxy.send<T[]>(pattern, payload).pipe(timeout(this.timeoutMs))
    );
    return Array.isArray(reply) ? reply : [];
  }
}
