import { Injectable, OnDestroy } from '@angular/core';
import { BUG_REPORT_LIMITS } from './bug-report.models';

/**
 * In-memory ring buffer of recent browser console output + uncaught errors.
 * Patches console.* once; call start() from app initializer, stop() on destroy.
 * Backend trace ids (x-request-id) are recorded separately via interceptor
 * or manual `addTraceId()` calls.
 */
@Injectable({ providedIn: 'root' })
export class LogBufferService implements OnDestroy {
  private logs: string[] = [];
  private traceIds: string[] = [];
  private started = false;
  private readonly orig = new Map<string, (...args: unknown[]) => void>();

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    (['log', 'warn', 'error', 'info', 'debug'] as const).forEach((level) => {
      const original = console[level].bind(console);
      this.orig.set(level, original as (...args: unknown[]) => void);
      (console as unknown as Record<string, unknown>)[level] = (
        ...args: unknown[]
      ) => {
        this.push(level, args);
        (this.orig.get(level) as (...a: unknown[]) => void)(...args);
      };
    });
    window.addEventListener('error', this.onError);
    window.addEventListener('unhandledrejection', this.onRejection);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.orig.forEach((fn, level) => {
      (console as unknown as Record<string, unknown>)[level] = fn;
    });
    this.orig.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', this.onError);
      window.removeEventListener('unhandledrejection', this.onRejection);
    }
  }

  addTraceId(id: string): void {
    if (!id) return;
    this.traceIds.push(id.slice(0, 200));
    if (this.traceIds.length > BUG_REPORT_LIMITS.backendTraceIdsMax) {
      this.traceIds = this.traceIds.slice(
        -BUG_REPORT_LIMITS.backendTraceIdsMax
      );
    }
  }

  getSnapshot(): string[] {
    return [...this.logs];
  }

  getTraceIds(): string[] {
    return [...this.traceIds];
  }

  clear(): void {
    this.logs = [];
    this.traceIds = [];
  }

  private readonly onError = (event: ErrorEvent) => {
    this.push('error', [
      `window.onerror: ${event.message} @ ${event.filename}:${event.lineno}`,
    ]);
  };

  private readonly onRejection = (event: PromiseRejectionEvent) => {
    const reason =
      event.reason instanceof Error
        ? event.reason.stack || event.reason.message
        : String(event.reason);
    this.push('error', [`unhandledrejection: ${reason}`]);
  };

  private push(level: string, args: unknown[]): void {
    const line = `${new Date().toISOString()} [${level}] ${args
      .map((a) => {
        try {
          return typeof a === 'string' ? a : JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ')}`.slice(0, BUG_REPORT_LIMITS.browserLogEntryMax);
    this.logs.push(line);
    if (this.logs.length > BUG_REPORT_LIMITS.browserLogsMax) {
      this.logs = this.logs.slice(-BUG_REPORT_LIMITS.browserLogsMax);
    }
  }
}
