import { randomUUID } from 'node:crypto';
import { AccountExportJobService } from '../account-export-jobs/account-export-job.service';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
it('drains admitted export runs for one account, preserves a foreign run and refuses late capture', async () => {
  const service = new (AccountExportJobService as any)();
  const own = randomUUID(),
    foreign = randomUUID();
  let releaseOwn!: () => void, releaseForeign!: () => void;
  service.runCurrent = jest.fn(async (input: any) => {
    await new Promise<void>((resolve) => {
      if (input.accountId === own) releaseOwn = resolve;
      else releaseForeign = resolve;
    });
    return { state: 'failed' };
  });
  const first = service.run({ accountId: own }, {}),
    second = service.run({ accountId: foreign }, {});
  let complete = false;
  const purge = service.purgeAccount(own).then(() => {
    complete = true;
  });
  await Promise.resolve();
  expect(complete).toBe(false);
  releaseOwn();
  await first;
  await purge;
  expect(await service.readbackAccount(own)).toBe(0);
  expect(service.runCurrent).toHaveBeenCalledTimes(2);
  expect(
    await service
      .run({ accountId: own }, {})
      .catch((error: any) => error.getError())
  ).toMatchObject({ code: 'EXPORT_ACCOUNT_DELETION_FENCED' });
  releaseForeign();
  await second;
});
