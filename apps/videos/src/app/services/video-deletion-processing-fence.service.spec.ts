import { randomUUID } from 'node:crypto';
import { VideoDeletionProcessingFenceService } from './video-deletion-processing-fence.service';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

describe('Videos processing deletion admission', () => {
  const video = randomUUID(),
    profile = randomUUID(),
    account = randomUUID();
  let runner: any, service: VideoDeletionProcessingFenceService;
  beforeEach(() => {
    runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
      query: jest.fn(async (sql: string) =>
        sql.includes('SELECT c.')
          ? [{ userId: account, profileId: profile }]
          : []
      ),
    };
    service = new VideoDeletionProcessingFenceService({
      createQueryRunner: () => runner,
    } as never);
  });
  it('keeps the shared drain lease until processing and import cleanup finish', async () => {
    let finish!: () => void;
    const work = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const running = service.run(video, work);
    while (!finish) await new Promise((resolve) => setImmediate(resolve));
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.release).not.toHaveBeenCalled();
    finish();
    await running;
    expect(work).toHaveBeenCalledWith(profile);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });
  it('does not start work for a fenced or changed parent identity', async () => {
    const work = jest.fn();
    runner.query.mockImplementation(async (sql: string) =>
      sql.includes('SELECT c.')
        ? [{ userId: account, profileId: profile }]
        : sql.includes('SELECT "key"')
        ? [{ key: 'fenced' }]
        : []
    );
    await expect(service.run(video, work)).rejects.toThrow(
      'VIDEO_PROCESSING_DELETION_FENCED'
    );
    expect(work).not.toHaveBeenCalled();
    runner.query
      .mockResolvedValueOnce([{ userId: account, profileId: profile }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: account, profileId: randomUUID() }]);
    await expect(service.run(video, work)).rejects.toThrow(
      'VIDEO_PROCESSING_BINDING_CHANGED'
    );
    expect(work).not.toHaveBeenCalled();
  });
  it('does not open a transaction for malformed video IDs', async () => {
    await expect(service.run('../other', jest.fn())).rejects.toThrow(
      'VIDEO_PROCESSING_ID_INVALID'
    );
    expect(runner.connect).not.toHaveBeenCalled();
  });
});
