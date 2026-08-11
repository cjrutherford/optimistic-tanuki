export type PerformanceRenderMode =
  | 'Client'
  | 'Server'
  | 'Prerender'
  | 'Unknown';

export type PerformanceMetricName =
  | 'lcp'
  | 'inp'
  | 'cls'
  | 'ttfb'
  | 'route_transition'
  | 'hydration'
  | 'long_task';

export interface PerformanceMetricInput {
  name: PerformanceMetricName;
  value: number;
  timestamp?: number;
}

export interface PerformanceRumInput {
  appId: string;
  route: string;
  renderMode?: PerformanceRenderMode;
  metrics: PerformanceMetricInput[];
}

export type RuntimeMetricName =
  | 'cpu_utilization'
  | 'memory_rss_bytes'
  | 'gc_pause_ms'
  | 'gc_pause_count';

export interface RuntimeMetricInput {
  name: RuntimeMetricName;
  value: number;
}

export interface RuntimeObservationInput {
  appId: string;
  source: 'otel';
  observedAt: string;
  metrics: RuntimeMetricInput[];
}

export interface RuntimeSummary {
  appId: string;
  source: 'otel';
  observedAt: string;
  cpuUtilization?: number;
  memoryRssBytes?: number;
  gcPauseMs?: number;
  gcPauseCount?: number;
}

export interface PerformanceMetricSummary {
  samples: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface PerformanceSummary {
  appId: string;
  route: string;
  renderMode: PerformanceRenderMode;
  metrics: Partial<Record<PerformanceMetricName, PerformanceMetricSummary>>;
}

export type PerformanceAlertSeverity = 'warning' | 'critical';
export type PerformanceAlertState = 'active' | 'recovered' | 'acknowledged';

export interface PerformanceAlert {
  id: string;
  incidentKey: string;
  appId: string;
  route: string;
  metric: PerformanceMetricName;
  severity: PerformanceAlertSeverity;
  state: PerformanceAlertState;
  threshold: number;
  observed: number;
  createdAt: string;
  recoveredAt?: string;
}

export interface PerformanceTelemetryOptions {
  clock?: () => number;
  bucketMs?: number;
  minSamples?: number;
  requiredWindows?: number;
}

const DEFAULT_THRESHOLDS: Partial<Record<PerformanceMetricName, number>> = {
  lcp: 2500,
  inp: 200,
  cls: 0.1,
  ttfb: 800,
  route_transition: 2000,
  hydration: 2000,
  long_task: 200,
};

interface WindowData {
  values: number[];
  lastEvaluatedAt?: number;
}

export class PerformanceTelemetryService {
  private readonly clock: () => number;
  private readonly bucketMs: number;
  private readonly minSamples: number;
  private readonly requiredWindows: number;
  private readonly windows = new Map<string, WindowData>();
  private readonly breachStreaks = new Map<string, number>();
  private readonly alerts = new Map<string, PerformanceAlert>();
  private readonly runtimeSnapshots = new Map<string, RuntimeSummary>();

  constructor(options: PerformanceTelemetryOptions = {}) {
    this.clock = options.clock ?? Date.now;
    this.bucketMs = options.bucketMs ?? 5 * 60_000;
    this.minSamples = options.minSamples ?? 20;
    this.requiredWindows = options.requiredWindows ?? 2;
  }

  record(input: PerformanceRumInput): PerformanceAlert[] {
    const now = this.clock();
    const triggered: PerformanceAlert[] = [];
    for (const metric of input.metrics ?? []) {
      if (!this.isValidMetric(metric)) continue;
      const key = this.key(
        input.appId,
        input.route,
        input.renderMode ?? 'Unknown',
        metric.name
      );
      const bucket = Math.floor(now / this.bucketMs) * this.bucketMs;
      const windowKey = `${key}:${bucket}`;
      const window = this.windows.get(windowKey) ?? { values: [] };
      window.values.push(metric.value);
      this.windows.set(windowKey, window);
      if (
        window.values.length >= this.minSamples &&
        window.lastEvaluatedAt !== bucket
      ) {
        window.lastEvaluatedAt = bucket;
        const observed = percentile(window.values, 0.75);
        const threshold = DEFAULT_THRESHOLDS[metric.name];
        if (threshold !== undefined && observed > threshold) {
          const streak = (this.breachStreaks.get(key) ?? 0) + 1;
          this.breachStreaks.set(key, streak);
          if (streak >= this.requiredWindows) {
            const incidentKey = `${key}:${metric.name}`;
            const existing = this.alerts.get(incidentKey);
            if (!existing || existing.state === 'recovered') {
              const alert: PerformanceAlert = {
                id: incidentKey,
                incidentKey,
                appId: input.appId,
                route: input.route,
                metric: metric.name,
                severity: observed > threshold * 2 ? 'critical' : 'warning',
                state: 'active',
                threshold,
                observed,
                createdAt: new Date(now).toISOString(),
              };
              this.alerts.set(incidentKey, alert);
              triggered.push(alert);
            }
          }
        } else {
          this.breachStreaks.set(key, 0);
          const existing = this.alerts.get(`${key}:${metric.name}`);
          if (existing?.state === 'active') {
            existing.state = 'recovered';
            existing.recoveredAt = new Date(now).toISOString();
          }
        }
      }
    }
    return triggered;
  }

  summaries(): PerformanceSummary[] {
    const grouped = new Map<string, number[]>();
    for (const [windowKey, window] of this.windows) {
      const key = windowKey.slice(0, windowKey.lastIndexOf(':'));
      const values = grouped.get(key) ?? [];
      values.push(...window.values);
      grouped.set(key, values);
    }
    return [...grouped].map(([key, values]) => {
      const [appId, route, renderMode, metric] = key.split('|');
      return {
        appId,
        route,
        renderMode: renderMode as PerformanceRenderMode,
        metrics: {
          [metric]: {
            samples: values.length,
            p50: percentile(values, 0.5),
            p75: percentile(values, 0.75),
            p95: percentile(values, 0.95),
          },
        },
      };
    });
  }

  listAlerts(): PerformanceAlert[] {
    return [...this.alerts.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  recordRuntime(input: RuntimeObservationInput): void {
    if (!input?.appId || input.source !== 'otel') return;
    const observedAt = Date.parse(input.observedAt);
    if (!Number.isFinite(observedAt)) return;
    const current = this.runtimeSnapshots.get(input.appId) ?? {
      appId: input.appId,
      source: 'otel',
      observedAt: new Date(observedAt).toISOString(),
    };
    for (const metric of input.metrics ?? []) {
      if (!this.isValidRuntimeMetric(metric)) continue;
      if (metric.name === 'cpu_utilization')
        current.cpuUtilization = metric.value;
      if (metric.name === 'memory_rss_bytes')
        current.memoryRssBytes = metric.value;
      if (metric.name === 'gc_pause_ms') current.gcPauseMs = metric.value;
      if (metric.name === 'gc_pause_count') current.gcPauseCount = metric.value;
    }
    current.observedAt = new Date(observedAt).toISOString();
    this.runtimeSnapshots.set(input.appId, current);
  }

  runtimeSummaries(): RuntimeSummary[] {
    return [...this.runtimeSnapshots.values()].sort((a, b) =>
      a.appId.localeCompare(b.appId)
    );
  }

  prometheus(): string {
    const lines = [
      '# HELP ot_performance_metric_p75 Aggregated performance metric p75.',
      '# TYPE ot_performance_metric_p75 gauge',
      '# HELP ot_performance_metric_samples Aggregated performance metric sample count.',
      '# TYPE ot_performance_metric_samples gauge',
      '# HELP ot_performance_active_alerts Number of active performance alerts.',
      '# TYPE ot_performance_active_alerts gauge',
      '# HELP ot_runtime_cpu_utilization Latest OTEL process CPU utilization.',
      '# TYPE ot_runtime_cpu_utilization gauge',
      '# HELP ot_runtime_memory_rss_bytes Latest OTEL process resident memory.',
      '# TYPE ot_runtime_memory_rss_bytes gauge',
      '# HELP ot_runtime_gc_pause_ms Latest OTEL GC pause duration.',
      '# TYPE ot_runtime_gc_pause_ms gauge',
      '# HELP ot_runtime_gc_pause_count OTEL GC pauses observed in the latest interval.',
      '# TYPE ot_runtime_gc_pause_count gauge',
    ];
    for (const summary of this.summaries()) {
      for (const [metric, value] of Object.entries(summary.metrics)) {
        const labels = `app="${escapeLabel(
          summary.appId
        )}",route="${escapeLabel(summary.route)}",render_mode="${
          summary.renderMode
        }",metric="${metric}"`;
        lines.push(`ot_performance_metric_p75{${labels}} ${value?.p75 ?? 0}`);
        lines.push(
          `ot_performance_metric_samples{${labels}} ${value?.samples ?? 0}`
        );
      }
    }
    const active = this.listAlerts().filter(
      (alert) => alert.state === 'active'
    ).length;
    lines.push(`ot_performance_active_alerts ${active}`);
    for (const runtime of this.runtimeSummaries()) {
      const labels = `app="${escapeLabel(runtime.appId)}",source="otel"`;
      if (runtime.cpuUtilization !== undefined)
        lines.push(
          `ot_runtime_cpu_utilization{${labels}} ${runtime.cpuUtilization}`
        );
      if (runtime.memoryRssBytes !== undefined)
        lines.push(
          `ot_runtime_memory_rss_bytes{${labels}} ${runtime.memoryRssBytes}`
        );
      if (runtime.gcPauseMs !== undefined)
        lines.push(`ot_runtime_gc_pause_ms{${labels}} ${runtime.gcPauseMs}`);
      if (runtime.gcPauseCount !== undefined)
        lines.push(
          `ot_runtime_gc_pause_count{${labels}} ${runtime.gcPauseCount}`
        );
    }
    return `${lines.join('\n')}\n`;
  }

  acknowledge(id: string): PerformanceAlert | undefined {
    const alert = this.alerts.get(id);
    if (alert?.state === 'active') alert.state = 'acknowledged';
    return alert;
  }

  private key(
    appId: string,
    route: string,
    renderMode: PerformanceRenderMode,
    metric: PerformanceMetricName
  ): string {
    return `${safePart(appId)}|${safePart(route)}|${renderMode}|${metric}`;
  }

  private isValidMetric(metric: PerformanceMetricInput): boolean {
    return (
      !!metric &&
      !!DEFAULT_THRESHOLDS[metric.name] &&
      Number.isFinite(metric.value) &&
      metric.value >= 0 &&
      metric.value < 86_400_000
    );
  }

  private isValidRuntimeMetric(metric: RuntimeMetricInput): boolean {
    return (
      !!metric &&
      [
        'cpu_utilization',
        'memory_rss_bytes',
        'gc_pause_ms',
        'gc_pause_count',
      ].includes(metric.name) &&
      Number.isFinite(metric.value) &&
      metric.value >= 0
    );
  }
}

function safePart(value: string): string {
  return (
    String(value || '')
      .replace(/[|\n\r]/g, '')
      .slice(0, 120) || 'unknown'
  );
}

function percentile(values: number[], quantile: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil(quantile * sorted.length) - 1
  );
  return sorted[Math.max(0, index)];
}

function escapeLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}
