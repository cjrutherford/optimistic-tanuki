import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { EditionsController } from './editions.controller';

const briefing = {
  slug: 'tifton-ga',
  name: 'Tifton',
  state: 'GA',
  cadence: 'daily',
  periodStart: '2026-09-16',
  periodEnd: '2026-09-16',
  createdAt: '2026-09-16T12:00:00Z',
  markdown: '# Tifton',
};

function controller(reply: (cmd: string, payload: unknown) => unknown) {
  const send = jest.fn((pattern: { cmd: string }, payload: unknown) => {
    const value = reply(pattern.cmd, payload);
    return value instanceof Error ? throwError(() => value) : of(value);
  });
  return { editions: new EditionsController({ send } as never), send };
}

describe('EditionsController', () => {
  it('lists editions from civic-briefing', async () => {
    const { editions, send } = controller(() => [{ slug: 'tifton-ga' }]);
    expect(await editions.editions()).toEqual({
      data: [{ slug: 'tifton-ga' }],
    });
    expect(send).toHaveBeenCalledWith(
      { cmd: 'civic-briefing.editions.list' },
      {}
    );
  });

  it("returns a town's briefing for a date", async () => {
    const { editions, send } = controller(() => briefing);
    expect(await editions.briefing('tifton-ga', '2026-09-16')).toEqual({
      data: briefing,
    });
    expect(send).toHaveBeenCalledWith(
      { cmd: 'civic-briefing.editions.briefing' },
      { slug: 'tifton-ga', periodEnd: '2026-09-16' }
    );
  });

  it('answers 404 when there is nothing published', async () => {
    const { editions } = controller(() => null);
    await expect(editions.edition('nowhere-ga')).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(editions.latest('nowhere-ga')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('answers 503 when civic-briefing cannot be reached', async () => {
    const { editions } = controller(() => new Error('ECONNREFUSED'));
    await expect(editions.editions()).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
