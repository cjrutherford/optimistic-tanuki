export type PerformanceMetricName =
  | 'lcp'
  | 'inp'
  | 'cls'
  | 'ttfb'
  | 'route_transition'
  | 'hydration'
  | 'long_task';

export interface PerformanceMetric {
  name: PerformanceMetricName;
  value: number;
  timestamp?: number;
}

export interface PerformanceRumPayload {
  appId: string;
  route: string;
  renderMode: 'Client' | 'Server' | 'Prerender' | 'Unknown';
  metrics: PerformanceMetric[];
}

export interface PerformanceMonitorOptions {
  appId: string;
  renderMode?: PerformanceRumPayload['renderMode'];
  endpoint?: string;
  flushDelayMs?: number;
  includeBufferedEntries?: boolean;
  flushOnStop?: boolean;
}

export interface GatedPerformanceMonitor {
  stop(): void;
}

const eligibilityListeners = new Map<string, Set<(eligible: boolean) => void>>();

/** Publish the result of an app-scoped session restore validated by the server. */
export function setPerformanceMonitoringEligibility(
  appId: string,
  eligible: boolean
): void {
  eligibilityListeners.get(appId)?.forEach((listener) => listener(eligible));
}

/** RUM remains off until a server-validated, app-scoped session is restored. */
export function startGatedPerformanceMonitoring(
  options: PerformanceMonitorOptions
): GatedPerformanceMonitor {
  let eligible = false;
  let stopMonitor: (() => void) | undefined;
  const updateEligibility = (nextEligible: boolean) => {
    if (eligible === nextEligible) return;
    eligible = nextEligible;
    if (eligible) {
      stopMonitor = startPerformanceMonitoring({
        ...options,
        includeBufferedEntries: false,
        flushOnStop: false,
      });
    } else {
      stopMonitor?.();
      stopMonitor = undefined;
    }
  };
  const listeners = eligibilityListeners.get(options.appId) ?? new Set();
  listeners.add(updateEligibility);
  eligibilityListeners.set(options.appId, listeners);
  return {
    stop() {
      listeners.delete(updateEligibility);
      if (!listeners.size) eligibilityListeners.delete(options.appId);
      stopMonitor?.();
      stopMonitor = undefined;
      eligible = false;
    },
  };
}

export function normalizePerformanceRoute(path: string): string {
  return (
    path
      .split('?')[0]
      .split('/')
      .map((segment) => {
        if (!segment) return segment;
        if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return ':id';
        if (/^\d+$/.test(segment)) return ':id';
        return segment.length > 80 ? ':param' : segment;
      })
      .join('/') || '/'
  );
}

export function createPerformanceReporter(
  options: PerformanceMonitorOptions,
  send: (payload: PerformanceRumPayload) => void
): {
  record: (metric: PerformanceMetric) => void;
  flush: () => void;
  clear: () => void;
} {
  const metrics: PerformanceMetric[] = [];

  const flush = () => {
    if (!metrics.length) return;
    send({
      appId: options.appId,
      route:
        typeof window === 'undefined'
          ? '/'
          : normalizePerformanceRoute(window.location.pathname),
      renderMode: options.renderMode ?? 'Unknown',
      metrics: metrics.splice(0),
    });
  };

  return {
    record(metric) {
      if (!Number.isFinite(metric.value) || metric.value < 0) return;
      metrics.push({ ...metric, timestamp: metric.timestamp ?? Date.now() });
      if (options.flushDelayMs === 0) flush();
    },
    flush,
    clear() {
      metrics.length = 0;
    },
  };
}

export function startPerformanceMonitoring(
  options: PerformanceMonitorOptions
): () => void {
  if (
    typeof window === 'undefined' ||
    typeof PerformanceObserver === 'undefined'
  ) {
    return () => undefined;
  }

  const endpoint = options.endpoint ?? '/api/performance/rum';
  const reporter = createPerformanceReporter(options, (payload) => {
    const body = JSON.stringify(payload);
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(
        endpoint,
        new Blob([body], { type: 'application/json' })
      );
    } else {
      void fetch(endpoint, {
        method: 'POST',
        body,
        headers: { 'content-type': 'application/json' },
        keepalive: true,
      });
    }
  });
  const observers: PerformanceObserver[] = [];

  const observe = (
    type: string,
    name: PerformanceMetricName,
    value: (entry: PerformanceEntry) => number
  ) => {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          reporter.record({ name, value: value(entry) });
        }
      });
      observer.observe({
        type,
        buffered: options.includeBufferedEntries !== false,
      } as PerformanceObserverInit);
      observers.push(observer);
    } catch {
      // Browser support varies; missing optional observers must not affect UX.
    }
  };

  observe('largest-contentful-paint', 'lcp', (entry) => entry.startTime);
  observe(
    'event',
    'inp',
    (entry) => (entry as PerformanceEventTiming).duration
  );
  observe('layout-shift', 'cls', (entry) => (entry as LayoutShiftEntry).value);
  observe('longtask', 'long_task', (entry) => entry.duration);

  const navigation = options.includeBufferedEntries === false
    ? undefined
    : (performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined);
  if (navigation) {
    reporter.record({
      name: 'ttfb',
      value: navigation.responseStart - navigation.requestStart,
    });
  }

  const flush = () => reporter.flush();
  window.addEventListener('pagehide', flush);
  const timer =
    options.flushDelayMs === 0
      ? undefined
      : window.setInterval(flush, options.flushDelayMs ?? 10_000);

  return () => {
    window.removeEventListener('pagehide', flush);
    if (timer !== undefined) window.clearInterval(timer);
    observers.forEach((observer) => observer.disconnect());
    if (options.flushOnStop === false) reporter.clear();
    else flush();
  };
}

interface PerformanceEventTiming extends PerformanceEntry {
  duration: number;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
}
