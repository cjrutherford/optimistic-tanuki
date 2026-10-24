import { PayloadFreeLogger } from './payload-free-logging';

describe('Payload-free Nest logging boundary', () => {
  it('rejects raw messages, errors, contexts and formatting arguments at every level', () => {
    const records: unknown[] = [];
    const logger = new PayloadFreeLogger((record) => records.push(record));
    for (const level of [
      'log',
      'error',
      'warn',
      'debug',
      'verbose',
      'fatal',
    ] as const)
      logger[level](new Error('PRIVATE_SENTINEL'), 'PRIVATE_SENTINEL', {
        accountId: 'PRIVATE_SENTINEL',
      });
    expect(records).toHaveLength(6);
    expect(JSON.stringify(records)).not.toContain('PRIVATE_SENTINEL');
    expect(
      records.every(
        (record) =>
          (record as { event: string }).event === 'diagnostic.rejected'
      )
    ).toBe(true);
  });
  it('keeps only declared metadata and never executes getters or toJSON', () => {
    const write = jest.fn();
    const logger = new PayloadFreeLogger(write);
    const getter = jest.fn(() => 'PRIVATE_SENTINEL');
    logger.error({
      event: 'profile.operation',
      outcome: 'failed',
      userId: 'PRIVATE_SENTINEL',
      toJSON: getter,
    });
    logger.log(Object.defineProperty({}, 'event', { get: getter }));
    expect(getter).not.toHaveBeenCalled();
    expect(write).toHaveBeenNthCalledWith(1, {
      level: 'error',
      event: 'profile.operation',
      outcome: 'failed',
    });
    expect(write).toHaveBeenNthCalledWith(2, {
      level: 'log',
      event: 'diagnostic.rejected',
    });
  });
});
