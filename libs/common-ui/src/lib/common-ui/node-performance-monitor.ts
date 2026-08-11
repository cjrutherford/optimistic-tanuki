export interface NodeRuntimeMonitorOptions {
  appId: string;
  gatewayEndpoint?: string;
  otlpEndpoint?: string;
  intervalMs?: number;
}

interface RuntimeMetric {
  name:
    | 'cpu_utilization'
    | 'memory_rss_bytes'
    | 'gc_pause_ms'
    | 'gc_pause_count';
  value: number;
}

type NodeProcess = {
  cpuUsage(previous?: { user: number; system: number }): {
    user: number;
    system: number;
  };
  memoryUsage(): { rss: number };
};
type GcObserver = {
  observe(options: { entryTypes: string[] }): void;
  disconnect(): void;
};

/** Reports process-level SSR runtime measurements without affecting request handling. */
export function startNodeRuntimeMonitoring(
  options: NodeRuntimeMonitorOptions
): () => void {
  const intervalMs = options.intervalMs ?? 15_000;
  const gatewayEndpoint = options.gatewayEndpoint?.replace(/\/$/, '');
  const otlpEndpoint = options.otlpEndpoint?.replace(/\/$/, '');
  const nodeProcess = (globalThis as { process?: NodeProcess }).process;
  if (!nodeProcess) return () => undefined;
  let previousCpu = nodeProcess.cpuUsage();
  let previousAt = Date.now();
  const gcPauses: number[] = [];
  let observer: GcObserver | undefined;

  try {
    const Observer = (
      globalThis as {
        PerformanceObserver?: new (
          callback: (list: {
            getEntries(): Array<{ duration: number }>;
          }) => void
        ) => GcObserver;
      }
    ).PerformanceObserver;
    if (Observer) {
      observer = new Observer((list) => {
        for (const entry of list.getEntries()) gcPauses.push(entry.duration);
      });
    }
    if (!observer) throw new Error('GC observer unavailable');
    observer.observe({ entryTypes: ['gc'] });
  } catch {
    observer = undefined;
  }

  const timer = setInterval(() => {
    const now = Date.now();
    const elapsedMs = Math.max(1, now - previousAt);
    const cpu = nodeProcess.cpuUsage(previousCpu);
    previousCpu = nodeProcess.cpuUsage();
    previousAt = now;
    const metrics: RuntimeMetric[] = [
      {
        name: 'cpu_utilization',
        value: (cpu.user + cpu.system) / (elapsedMs * 1_000),
      },
      { name: 'memory_rss_bytes', value: nodeProcess.memoryUsage().rss },
      { name: 'gc_pause_count', value: gcPauses.length },
    ];
    if (gcPauses.length) {
      metrics.push({ name: 'gc_pause_ms', value: Math.max(...gcPauses) });
    }
    gcPauses.length = 0;
    const observedAt = new Date(now).toISOString();
    const payload = JSON.stringify({
      appId: options.appId,
      source: 'otel',
      observedAt,
      metrics,
    });
    if (gatewayEndpoint) {
      void send(`${gatewayEndpoint}/api/performance/runtime`, payload);
    }
    if (otlpEndpoint) {
      void send(
        `${otlpEndpoint}/v1/metrics`,
        otlpPayload(options.appId, metrics, now)
      );
    }
  }, intervalMs);

  (timer as unknown as { unref?: () => void }).unref?.();
  return () => {
    clearInterval(timer);
    observer?.disconnect();
  };
}

async function send(url: string, body: string): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
  } catch {
    // Telemetry must never make an SSR process unhealthy.
  }
}

function otlpPayload(
  appId: string,
  metrics: RuntimeMetric[],
  now: number
): string {
  const timeUnixNano = String(now * 1_000_000);
  return JSON.stringify({
    resourceMetrics: [
      {
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: appId } }],
        },
        scopeMetrics: [
          {
            scope: { name: 'optimistic-tanuki.runtime' },
            metrics: metrics.map((metric) => ({
              name: `ot.runtime.${metric.name}`,
              gauge: {
                dataPoints: [{ asDouble: metric.value, timeUnixNano }],
              },
            })),
          },
        ],
      },
    ],
  });
}
