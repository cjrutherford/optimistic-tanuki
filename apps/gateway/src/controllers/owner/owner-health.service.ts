import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'node:net';

/** Every probe gets this long; they all run at once. */
export const PROBE_TIMEOUT_MS = 2000;
/** A service that answers, but slower than this, is degraded. */
export const SLOW_MS = 1500;

export type HealthStatus = 'up' | 'down' | 'degraded';

export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  latencyMs: number | null;
  checkedAt: string;
  detail?: string;
}

interface Probe {
  name: string;
  run: () => Promise<{ ok: boolean; detail?: string }>;
}

interface HostPort {
  host?: unknown;
  port?: unknown;
  name?: unknown;
}

/**
 * Whether each service in the stack answers, probed now. The microservices are
 * reached by TCP connect (their only listener is the Nest TCP server); the
 * directory pair by their HTTP `/health/ready`; ClamAV by its own `PING`.
 * Nothing here reads deployment files: a service is up only if it answers.
 */
@Injectable()
export class OwnerHealthService {
  constructor(private readonly config: ConfigService) {}

  async check(): Promise<ServiceHealth[]> {
    return Promise.all(this.probes().map((probe) => this.measure(probe)));
  }

  probes(): Probe[] {
    const services = (this.config.get<Record<string, HostPort>>('services') ??
      {}) as Record<string, HostPort>;
    const probes: Probe[] = [];
    const seen = new Set<string>();
    for (const [key, entry] of Object.entries(services)) {
      const host = entry?.host;
      const port = entry?.port;
      if (typeof host !== 'string' || typeof port !== 'number') continue;
      const id = `${host}:${port}`;
      if (seen.has(id)) continue;
      seen.add(id);
      probes.push({
        name:
          typeof entry.name === 'string' && entry.name
            ? entry.name
            : key.replace(/_/g, '-'),
        run: () => this.tcp(host, port),
      });
    }

    const env = process.env;
    probes.push(
      {
        name: 'postgres',
        run: () => this.tcp(env['POSTGRES_HOST'] || 'db', 5432),
      },
      {
        name: 'redis',
        run: () => this.tcp(env['REDIS_HOST'] || 'redis', 6379),
      },
      {
        name: 'clamav',
        run: () => this.clamav(env['CLAMAV_HOST'] || 'clamav', 3310),
      },
      {
        name: 'directory',
        run: () => this.http(this.directoryUrl(3120, 'DIRECTORY_INTERNAL_URL')),
      },
      {
        name: 'directory-worker',
        run: () =>
          this.http(this.directoryUrl(3121, 'DIRECTORY_WORKER_HEALTH_URL')),
      }
    );
    return probes;
  }

  private directoryUrl(port: number, override: string): string | null {
    const explicit = process.env[override];
    const internal = process.env['DIRECTORY_INTERNAL_URL'];
    try {
      if (override !== 'DIRECTORY_INTERNAL_URL' && explicit) {
        return `${explicit.replace(/\/$/, '')}/health/ready`;
      }
      if (override === 'DIRECTORY_INTERNAL_URL') {
        if (!internal) return null;
        const url = new URL(internal);
        return `${url.protocol}//${url.hostname}:${port}/health/ready`;
      }
      return `http://directory-worker:${port}/health/ready`;
    } catch {
      return null;
    }
  }

  private async measure(probe: Probe): Promise<ServiceHealth> {
    const started = Date.now();
    const checkedAt = new Date().toISOString();
    try {
      const result = await probe.run();
      const latencyMs = Date.now() - started;
      if (!result.ok) {
        return {
          name: probe.name,
          status: result.detail?.startsWith('Answered') ? 'degraded' : 'down',
          latencyMs: result.detail?.startsWith('Answered') ? latencyMs : null,
          checkedAt,
          ...(result.detail ? { detail: result.detail } : {}),
        };
      }
      const slow = latencyMs > SLOW_MS;
      return {
        name: probe.name,
        status: slow ? 'degraded' : 'up',
        latencyMs,
        checkedAt,
        ...(slow ? { detail: 'Slow to answer' } : {}),
      };
    } catch {
      return {
        name: probe.name,
        status: 'down',
        latencyMs: null,
        checkedAt,
        detail: 'Probe failed',
      };
    }
  }

  /** Resolves when a connection opens. Never throws; failure is `ok: false`. */
  private tcp(
    host: string,
    port: number,
    onConnect?: (
      socket: import('node:net').Socket,
      done: (r: { ok: boolean; detail?: string }) => void
    ) => void
  ): Promise<{ ok: boolean; detail?: string }> {
    return new Promise((resolve) => {
      let settled = false;
      const socket = connect({ host, port });
      const done = (result: { ok: boolean; detail?: string }) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(PROBE_TIMEOUT_MS, () =>
        done({ ok: false, detail: 'Timed out' })
      );
      socket.once('error', () =>
        done({ ok: false, detail: 'Connection refused or unreachable' })
      );
      socket.once('connect', () => {
        if (onConnect) onConnect(socket, done);
        else done({ ok: true });
      });
    });
  }

  private clamav(host: string, port: number) {
    return this.tcp(host, port, (socket, done) => {
      socket.once('data', (chunk) =>
        done(
          chunk.toString().trim() === 'PONG'
            ? { ok: true }
            : { ok: false, detail: 'Answered, but not with PONG' }
        )
      );
      socket.write('zPING\0');
    });
  }

  private async http(
    url: string | null
  ): Promise<{ ok: boolean; detail?: string }> {
    if (!url) return { ok: false, detail: 'Not configured' };
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        redirect: 'error',
      });
      return response.ok
        ? { ok: true }
        : { ok: false, detail: `Answered ${response.status}` };
    } catch (error) {
      return {
        ok: false,
        detail:
          (error as { name?: string })?.name === 'TimeoutError'
            ? 'Timed out'
            : 'Unreachable',
      };
    }
  }
}
