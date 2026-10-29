import { createHash, randomUUID } from 'node:crypto';
import { AccountExportOwnerSpoolService } from './account-export-owner-spool.service';
import { AccountExportOwnerChunk } from '@optimistic-tanuki/models';
function options(accountId: string) {
  return {
    accountId,
    participantId: 'fixture',
    sources: ['alpha'],
    timeoutMs: 5000,
  };
}
async function ready(
  service: AccountExportOwnerSpoolService,
  accountId: string
) {
  const record = {
    source: 'alpha',
    data: { id: 'one', text: 'PRIVATE_FIXTURE' },
  };
  const common = {
    contractVersion: 1,
    schemaVersion: '2026-10-19.v1',
    participantId: 'fixture',
    accountId,
    captureId: randomUUID(),
    snapshotAt: new Date().toISOString(),
    uncovered: [],
  };
  return service.capture(options(accountId), async (consume) => {
    await consume({
      ...common,
      source: 'alpha',
      pageOrdinal: 1,
      cursor: 'one',
      records: [record],
      sourceComplete: true,
      endOfStream: false,
      complete: false,
    } as AccountExportOwnerChunk<string>);
    const end = {
      ...common,
      source: 'end',
      pageOrdinal: 2,
      cursor: null,
      records: [],
      sourceComplete: true,
      endOfStream: true,
      complete: true,
      rowCount: 1,
      checksum: createHash('sha256')
        .update(JSON.stringify(record) + '\n')
        .digest('hex'),
      sourceRowCounts: { alpha: 1 },
      sourceDispositions: { alpha: 'retained' },
    } as AccountExportOwnerChunk<string>;
    await consume(end);
    return end;
  });
}
it('drains owned anonymous file handles and rejects late capture while preserving counterpart reads', async () => {
  const service = new AccountExportOwnerSpoolService(),
    account = randomUUID();
  const own = await ready(service, account),
    foreign = await ready(service, randomUUID());
  await (service as any).purgeAccount(account);
  expect(await (service as any).readbackAccount(account)).toBe(0);
  expect(() => own.createReadStream()).toThrow('OWNER_SPOOL_CLOSED');
  expect(
    (await foreign.readChunk(0, foreign.metadata.sizeBytes)).toString()
  ).toContain('PRIVATE_FIXTURE');
  await expect(ready(service, account)).rejects.toThrow(
    'OWNER_SPOOL_ACCOUNT_FENCED'
  );
  await foreign.cleanup();
});
it('aborts and waits for a producer admitted before deletion', async () => {
  const service = new AccountExportOwnerSpoolService(),
    account = randomUUID();
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const capture = service.capture(
    options(account),
    async (_consume, signal) => {
      started();
      await new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve(), { once: true })
      );
      throw Error('CANCELLED');
    }
  );
  const rejected = expect(capture).rejects.toThrow();
  await entered;
  await (service as any).purgeAccount(account);
  await rejected;
  expect(await (service as any).readbackAccount(account)).toBe(0);
});
it('retains a failed FD close for readback and retry, rather than forgetting resource custody', async () => {
  const service = new AccountExportOwnerSpoolService(),
    account = randomUUID();
  await ready(service, account);
  const file = [...(service as any).resources.keys()][0];
  jest.spyOn(file, 'close').mockRejectedValueOnce(Error('CLOSE_FAILED'));
  await expect((service as any).purgeAccount(account)).rejects.toThrow(
    'CLOSE_FAILED'
  );
  expect(await (service as any).readbackAccount(account)).toBe(1);
  await (service as any).purgeAccount(account);
  expect(await (service as any).readbackAccount(account)).toBe(0);
});
