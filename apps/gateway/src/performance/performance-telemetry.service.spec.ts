import { PerformanceTelemetryService } from './performance-telemetry.service';

describe('PerformanceTelemetryService', () => {
  it('opens a warning only after two breached windows with enough samples', () => {
    let now = 0;
    const service = new PerformanceTelemetryService({
      clock: () => now,
      bucketMs: 1000,
      minSamples: 2,
      requiredWindows: 2,
    });
    const input = (timestamp: number) => ({
      appId: 'client-interface',
      route: '/feed',
      renderMode: 'Client' as const,
      metrics: [
        { name: 'lcp' as const, value: 3000, timestamp },
        { name: 'lcp' as const, value: 3200, timestamp },
      ],
    });

    expect(service.record(input(0))).toEqual([]);
    now = 1000;
    expect(service.record(input(1000))).toMatchObject([
      {
        appId: 'client-interface',
        metric: 'lcp',
        severity: 'warning',
        state: 'active',
      },
    ]);
  });

  it('ignores invalid metrics and exposes percentile summaries', () => {
    const service = new PerformanceTelemetryService({ minSamples: 1 });
    service.record({
      appId: 'forgeofwill',
      route: '/projects/:id',
      renderMode: 'Client',
      metrics: [
        { name: 'inp', value: 100 },
        { name: 'inp', value: -1 },
      ],
    });

    expect(service.summaries()[0].metrics.inp).toMatchObject({
      samples: 1,
      p50: 100,
      p75: 100,
      p95: 100,
    });
  });

  it('uses server time for buckets and evaluates each bucket only once', () => {
    let now = 0;
    const service = new PerformanceTelemetryService({
      clock: () => now,
      bucketMs: 1000,
      minSamples: 1,
      requiredWindows: 2,
    });
    const record = (timestamp: number) =>
      service.record({
        appId: 'client-interface',
        route: '/feed',
        renderMode: 'Client',
        metrics: [{ name: 'lcp', value: 3000, timestamp }],
      });

    expect(record(999_999)).toEqual([]);
    expect(record(1)).toEqual([]);
    now = 1000;
    expect(record(1)).toMatchObject([
      expect.objectContaining({ state: 'active', metric: 'lcp' }),
    ]);
  });

  it('stores the latest OTEL runtime observation for each app', () => {
    const service = new PerformanceTelemetryService();

    service.recordRuntime({
      appId: 'owner-console',
      source: 'otel',
      observedAt: '2026-08-10T20:00:00.000Z',
      metrics: [
        { name: 'cpu_utilization', value: 0.42 },
        { name: 'memory_rss_bytes', value: 1048576 },
        { name: 'gc_pause_ms', value: 12.5 },
      ],
    });

    expect(service.runtimeSummaries()).toEqual([
      expect.objectContaining({
        appId: 'owner-console',
        source: 'otel',
        observedAt: '2026-08-10T20:00:00.000Z',
        cpuUtilization: 0.42,
        memoryRssBytes: 1048576,
        gcPauseMs: 12.5,
      }),
    ]);
  });
});
