import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AiOrchestrationReadinessInterceptor } from './ai-orchestration-readiness.interceptor';

describe('AiOrchestrationReadinessInterceptor (O27b)', () => {
  const next = {
    handle: jest.fn().mockReturnValue(of('ok')),
  } as unknown as { handle: jest.Mock };

  beforeEach(() => {
    next.handle.mockClear();
  });

  const interceptorFor = (health: unknown, error?: unknown) =>
    new AiOrchestrationReadinessInterceptor({
      send: jest
        .fn()
        .mockReturnValue(error ? throwError(() => error) : of(health)),
    } as never);

  it('lets the call through when the orchestrator is healthy', async () => {
    const interceptor = interceptorFor({
      status: 'healthy',
      dependencies: { profile: 'enabled' },
    });

    await interceptor.intercept({} as never, next);

    expect(next.handle).toHaveBeenCalled();
  });

  it('fails closed with 503 when a required downstream reports disabled', async () => {
    const interceptor = interceptorFor({
      status: 'degraded',
      dependencies: { profile: 'enabled', telos: 'disabled' },
    });

    await expect(
      interceptor.intercept({} as never, next)
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the probe itself errors', async () => {
    const interceptor = interceptorFor(undefined, new Error('down'));

    await expect(
      interceptor.intercept({} as never, next)
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(next.handle).not.toHaveBeenCalled();
  });
});
