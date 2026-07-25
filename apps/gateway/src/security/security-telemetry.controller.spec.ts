import { SecurityTelemetryController } from './security-telemetry.controller';
import { SecurityTelemetryService } from './security-telemetry.service';

describe('SecurityTelemetryController', () => {
  const telemetry = {
    listEvents: jest.fn(),
    metrics: jest.fn(),
  } as unknown as jest.Mocked<SecurityTelemetryService>;

  beforeEach(() => jest.clearAllMocks());

  it('masks IP addresses for read-only security observers', async () => {
    telemetry.listEvents.mockResolvedValue({ events: [] });
    const controller = new SecurityTelemetryController(telemetry);

    await controller.listEvents({
      from: '2026-07-24T00:00:00.000Z',
      limit: '25',
    });

    expect(telemetry.listEvents).toHaveBeenCalledWith(
      { from: '2026-07-24T00:00:00.000Z', limit: 25 },
      { revealClientAddress: false }
    );
  });

  it('uses the separate enforcement endpoint to inspect full IP addresses', async () => {
    telemetry.listEvents.mockResolvedValue({ events: [] });
    const controller = new SecurityTelemetryController(telemetry);

    await controller.listDetailedEvents({ from: '2026-07-24T00:00:00.000Z' });

    expect(telemetry.listEvents).toHaveBeenCalledWith(
      { from: '2026-07-24T00:00:00.000Z', limit: undefined },
      { revealClientAddress: true }
    );
  });

  it('requests aggregate metrics for security observers', async () => {
    telemetry.metrics.mockResolvedValue({
      from: '2026-07-24T00:00:00.000Z',
      to: '2026-07-24T01:00:00.000Z',
      bucket: '5m',
      totals: {
        requests: 0,
        denied: 0,
        rateLimited: 0,
        blocked: 0,
        errors: 0,
        serverErrors: 0,
      },
      series: [],
      topPaths: [],
      topHosts: [],
    });
    const controller = new SecurityTelemetryController(telemetry);
    await controller.metrics({
      from: '2026-07-24T00:00:00.000Z',
      to: '2026-07-24T01:00:00.000Z',
      bucket: '5m',
    });
    expect(telemetry.metrics).toHaveBeenCalledWith({
      from: '2026-07-24T00:00:00.000Z',
      to: '2026-07-24T01:00:00.000Z',
      bucket: '5m',
    });
  });
});
