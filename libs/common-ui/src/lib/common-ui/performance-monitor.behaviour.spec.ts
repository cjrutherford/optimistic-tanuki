import {
  startPerformanceMonitoring,
  PerformanceRumPayload,
} from './performance-monitor';

/** One `new PerformanceObserver(...).observe({ type })` registration. */
interface ObserverRegistration {
  type: string;
  emit: (entries: Partial<PerformanceEntry>[]) => void;
  disconnect: jest.Mock<void, []>;
}

describe('startPerformanceMonitoring', () => {
  const RealBlob = globalThis.Blob;
  /** Maps each constructed Blob back to the string it was built from. */
  const blobBodies = new Map<Blob, string>();

  let registrations: ObserverRegistration[];
  /** Entry types whose `observe()` should throw, mimicking unsupported browsers. */
  let unsupportedTypes: Set<string>;
  let sendBeacon: jest.Mock<boolean, [string, Blob]>;
  let fetchMock: jest.Mock;

  const originalObserver = (
    globalThis as unknown as { PerformanceObserver?: unknown }
  ).PerformanceObserver;
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  // jsdom's `performance` does not expose a spy-able `getEntriesByType`, so it
  // is replaced by definition like `fetch` and `sendBeacon` above rather than
  // with jest.spyOn, and its original descriptor restored in afterEach.
  const originalGetEntriesByType = Object.getOwnPropertyDescriptor(
    performance,
    'getEntriesByType'
  );

  /**
   * jsdom ships no usable PerformanceObserver, so the whole class is replaced
   * with a recorder that hands each registration's callback back to the test.
   */
  function installFakeObserver(): void {
    class FakePerformanceObserver {
      constructor(private readonly callback: (list: unknown) => void) {}

      disconnect = jest.fn<void, []>();

      observe(init: { type: string; buffered?: boolean }): void {
        if (unsupportedTypes.has(init.type)) {
          throw new TypeError(`unsupported entry type: ${init.type}`);
        }
        registrations.push({
          type: init.type,
          emit: (entries) =>
            this.callback({ getEntries: () => entries as PerformanceEntry[] }),
          disconnect: this.disconnect,
        });
      }
    }

    (
      globalThis as unknown as { PerformanceObserver: unknown }
    ).PerformanceObserver = FakePerformanceObserver;
  }

  /** Decodes the JSON payload handed to the most recent `sendBeacon` call. */
  function lastBeaconPayload(): PerformanceRumPayload {
    const calls = sendBeacon.mock.calls;
    const blob = calls[calls.length - 1][1];
    return JSON.parse(String(blobBodies.get(blob)));
  }

  beforeEach(() => {
    jest.useFakeTimers();
    registrations = [];
    unsupportedTypes = new Set<string>();
    blobBodies.clear();
    installFakeObserver();

    sendBeacon = jest.fn<boolean, [string, Blob]>().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      writable: true,
      value: sendBeacon,
    });

    fetchMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock,
    });

    // Blob contents are only readable asynchronously in jsdom, so capture the
    // source string at construction time to keep the assertions synchronous.
    class RecordingBlob extends RealBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        blobBodies.set(this, String(parts[0]));
      }
    }
    globalThis.Blob = RecordingBlob as unknown as typeof Blob;

    // Still a jest.fn so the tests can assert it was never consulted.
    Object.defineProperty(performance, 'getEntriesByType', {
      configurable: true,
      writable: true,
      value: jest.fn((type: string) =>
        type === 'navigation'
          ? ([
              { requestStart: 20, responseStart: 145 },
            ] as unknown as PerformanceEntryList)
          : []
      ),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    globalThis.Blob = RealBlob;
    (
      globalThis as unknown as { PerformanceObserver?: unknown }
    ).PerformanceObserver = originalObserver;
    delete (navigator as unknown as { sendBeacon?: unknown }).sendBeacon;
    if (originalGetEntriesByType) {
      Object.defineProperty(
        performance,
        'getEntriesByType',
        originalGetEntriesByType
      );
    } else {
      delete (performance as unknown as { getEntriesByType?: unknown })
        .getEntriesByType;
    }
    if (originalFetch) {
      Object.defineProperty(globalThis, 'fetch', originalFetch);
    } else {
      delete (globalThis as unknown as { fetch?: unknown }).fetch;
    }
    window.history.replaceState({}, '', '/');
  });

  it('instruments nothing and returns an inert teardown when PerformanceObserver is unavailable', () => {
    delete (globalThis as unknown as { PerformanceObserver?: unknown })
      .PerformanceObserver;

    const stop = startPerformanceMonitoring({ appId: 'client-interface' });

    expect(performance.getEntriesByType).not.toHaveBeenCalled();
    expect(stop()).toBeUndefined();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('subscribes to the four web-vitals entry types with buffered entries', () => {
    const stop = startPerformanceMonitoring({ appId: 'client-interface' });

    expect(registrations.map((r) => r.type)).toEqual([
      'largest-contentful-paint',
      'event',
      'layout-shift',
      'longtask',
    ]);
    stop();
  });

  it('keeps the supported observers when a browser rejects an entry type', () => {
    unsupportedTypes.add('layout-shift');

    const stop = startPerformanceMonitoring({ appId: 'client-interface' });

    expect(registrations.map((r) => r.type)).toEqual([
      'largest-contentful-paint',
      'event',
      'longtask',
    ]);
    stop();
  });

  it.each([
    ['largest-contentful-paint', 'lcp', { startTime: 2400 }, 2400],
    ['event', 'inp', { startTime: 10, duration: 180 }, 180],
    ['layout-shift', 'cls', { startTime: 10, value: 0.12 }, 0.12],
    ['longtask', 'long_task', { startTime: 10, duration: 320 }, 320],
  ])(
    'maps %s entries to the %s metric',
    (entryType, metricName, entry, expectedValue) => {
      const stop = startPerformanceMonitoring({ appId: 'client-interface' });
      const registration = registrations.find((r) => r.type === entryType);
      registration?.emit([entry as Partial<PerformanceEntry>]);

      stop();

      expect(lastBeaconPayload().metrics).toContainEqual(
        expect.objectContaining({ name: metricName, value: expectedValue })
      );
    }
  );

  it('records TTFB from navigation timing and beacons it on pagehide', () => {
    const stop = startPerformanceMonitoring({
      appId: 'client-interface',
      renderMode: 'Server',
    });

    window.dispatchEvent(new Event('pagehide'));

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe('/api/performance/rum');
    expect(lastBeaconPayload()).toMatchObject({
      appId: 'client-interface',
      renderMode: 'Server',
      metrics: [{ name: 'ttfb', value: 125 }],
    });
    stop();
  });

  it('flushes on the configured interval until teardown clears it', () => {
    const stop = startPerformanceMonitoring({
      appId: 'client-interface',
      flushDelayMs: 4000,
    });

    // The buffered TTFB sample makes the first interval tick non-empty.
    jest.advanceTimersByTime(4000);
    expect(sendBeacon).toHaveBeenCalledTimes(1);

    registrations[0].emit([{ startTime: 900 } as Partial<PerformanceEntry>]);
    jest.advanceTimersByTime(4000);
    expect(sendBeacon).toHaveBeenCalledTimes(2);
    expect(lastBeaconPayload().metrics).toEqual([
      expect.objectContaining({ name: 'lcp', value: 900 }),
    ]);

    stop();
    registrations[0].emit([{ startTime: 1100 } as Partial<PerformanceEntry>]);
    jest.advanceTimersByTime(20000);
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });

  it('disconnects every observer and detaches the pagehide listener on teardown', () => {
    const stop = startPerformanceMonitoring({ appId: 'client-interface' });
    const disconnects = registrations.map((r) => r.disconnect);

    stop();

    // Teardown flushes the buffered TTFB sample exactly once.
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    disconnects.forEach((disconnect) =>
      expect(disconnect).toHaveBeenCalledTimes(1)
    );

    registrations[0].emit([{ startTime: 700 } as Partial<PerformanceEntry>]);
    window.dispatchEvent(new Event('pagehide'));
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('posts to the custom endpoint with the normalized route when sendBeacon is missing', () => {
    delete (navigator as unknown as { sendBeacon?: unknown }).sendBeacon;
    window.history.replaceState({}, '', '/projects/42/tasks');

    const stop = startPerformanceMonitoring({
      appId: 'client-interface',
      renderMode: 'Client',
      endpoint: '/telemetry/rum',
    });
    stop();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/telemetry/rum');
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
    });
    expect(JSON.parse(init.body)).toMatchObject({
      appId: 'client-interface',
      renderMode: 'Client',
      route: '/projects/:id/tasks',
      metrics: [{ name: 'ttfb', value: 125 }],
    });
  });
});
