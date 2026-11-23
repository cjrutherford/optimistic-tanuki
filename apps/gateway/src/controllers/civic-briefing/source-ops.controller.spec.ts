import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import type { UserDetails } from '../../decorators/user.decorator';
import { SourceOpsController } from './source-ops.controller';

const operator = { userId: 'admin-1', name: 'Admin' } as UserDetails;
const id = '0b5f1c28-5b0e-4c61-9f27-5a3c1d4e8f10';

function fixture(reply: () => unknown = () => of({ items: [], total: 0 })) {
  const sent: { cmd: string; payload: unknown }[] = [];
  const briefings = {
    send: jest.fn((pattern: { cmd: string }, payload: unknown) => {
      sent.push({ cmd: pattern.cmd, payload });
      return reply();
    }),
  };
  return { controller: new SourceOpsController(briefings as never), sent };
}

const permission = (name: keyof SourceOpsController) =>
  Reflect.getMetadata(PERMISSIONS_KEY, SourceOpsController.prototype[name]);

describe('SourceOpsController', () => {
  it.each([
    ['decisions', 'sources.read'],
    ['overrides', 'sources.read'],
    ['health', 'sources.read'],
    ['requests', 'sources.read'],
    ['setOverride', 'sources.manage'],
    ['clearOverride', 'sources.manage'],
    ['decide', 'sources.manage'],
  ] as const)('guards %s with %s', (handler, name) => {
    expect(permission(handler)).toMatchObject({ permissions: [name] });
  });

  it('pages the decision log through civic-briefing', async () => {
    const page = { items: [], total: 0 };
    const { controller, sent } = fixture(() => of(page));
    expect(await controller.decisions('groton-ny', '10', '20')).toEqual({
      data: page,
    });
    expect(sent).toEqual([
      {
        cmd: CivicBriefingCommands.SOURCE_DECISIONS,
        payload: { slug: 'groton-ny', limit: 10, offset: 20 },
      },
    ]);
    await expect(
      controller.decisions('groton-ny', '-1')
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records the operator on an override and passes the reason through', async () => {
    const override = { id: 'o1', kind: 'block' };
    const { controller, sent } = fixture(() => of(override));
    const body = { sourceKey: 'civic-core-1', kind: 'block', reason: 'wrong' };
    expect(
      await controller.setOverride(operator, 'groton-ny', body as never)
    ).toEqual({ data: override });
    expect(sent[0]).toEqual({
      cmd: CivicBriefingCommands.SOURCE_OVERRIDE_SET,
      payload: {
        slug: 'groton-ny',
        sourceKey: 'civic-core-1',
        kind: 'block',
        reason: 'wrong',
        actor: 'admin-1',
      },
    });
  });

  it('answers 404 for an unknown town or a missing override', async () => {
    const { controller } = fixture(() => of(null));
    await expect(
      controller.setOverride(operator, 'x', {
        sourceKey: 'k',
        kind: 'pin',
        reason: 'r',
      } as never)
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      controller.clearOverride(operator, 'x', 'k', { reason: 'r' })
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.health('x')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('maps a refused value to 400 and a decided request to 409', async () => {
    const refuse = (status: number) =>
      fixture(() => throwError(() => ({ status, message: 'no' })));
    await expect(
      refuse(400).controller.decide(operator, id, {
        decision: 'approved',
        reason: '',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      refuse(409).controller.decide(operator, id, {
        decision: 'approved',
        reason: 'r',
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('answers 503, never an empty list, when civic-briefing is away', async () => {
    const { controller } = fixture(() => throwError(() => new Error('down')));
    await expect(controller.requests()).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    await expect(controller.overrides('groton-ny')).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('lists requests, pending by default, with the filters it was given', async () => {
    const { controller, sent } = fixture();
    await controller.requests('groton-ny', 'rejected', '5');
    expect(sent[0].payload).toEqual({
      slug: 'groton-ny',
      status: 'rejected',
      limit: 5,
      offset: undefined,
    });
  });

  it('decides a request as the operator, with the reason', async () => {
    const entry = { id, status: 'approved' };
    const { controller, sent } = fixture(() => of(entry));
    expect(
      await controller.decide(operator, id, {
        decision: 'approved',
        reason: 'found the feed',
      })
    ).toEqual({ data: entry });
    expect(sent[0].payload).toEqual({
      id,
      decision: 'approved',
      reason: 'found the feed',
      actor: 'admin-1',
    });
  });
});
