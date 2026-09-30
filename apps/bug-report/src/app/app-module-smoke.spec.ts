import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { BugReportController } from './reports/bug-report.controller';

/**
 * Boots the real AppModule (all providers, guards, no mocks) to catch DI
 * wiring regressions of the kind that crashed the assets service in e2e
 * (UnknownDependenciesException at startup).
 */
describe('AppModule (smoke)', () => {
  it('initializes and issues a nonce through the real controller', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const controller = app.get(BugReportController);
    const { nonce, expiresAt } = await controller.getNonce('127.0.0.1');
    expect(nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

    await app.close();
  });
});
