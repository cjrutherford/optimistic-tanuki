import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import { CommunityCommands } from '@optimistic-tanuki/civic-community';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import type { UserDetails } from '../../decorators/user.decorator';
import { CivicOperationsController } from './operations.controller';

const operator = { userId: 'admin-1', name: 'Admin' } as UserDetails;
const id = '0b5f1c28-5b0e-4c61-9f27-5a3c1d4e8f10';

function fixture(briefingReply: () => unknown = () => of({ towns: [] })) {
  const sent: { cmd: string; payload: unknown }[] = [];
  const briefingCalls: string[] = [];
  const briefings = {
    send: jest.fn((pattern: { cmd: string }) => {
      briefingCalls.push(pattern.cmd);
      return briefingReply();
    }),
  };
  const contributions = {
    send: jest.fn((pattern: { cmd: string }, payload: unknown) => {
      sent.push({ cmd: pattern.cmd, payload });
      return of({ ok: true });
    }),
  };
  return {
    controller: new CivicOperationsController(
      contributions as never,
      { send: jest.fn() } as never,
      briefings as never
    ),
    sent,
    briefingCalls,
  };
}

const metadata = (name: keyof CivicOperationsController, key: string) =>
  Reflect.getMetadata(key, CivicOperationsController.prototype[name]);

describe('CivicOperationsController', () => {
  it("reads Daylight's pipeline health from civic-briefing, for town.configure", async () => {
    const report = { configured: true, checkedAt: 'now', towns: [] };
    const { controller, briefingCalls } = fixture(() => of(report));
    expect(await controller.pipelineHealth()).toEqual({ data: report });
    expect(briefingCalls).toEqual([CivicBriefingCommands.PIPELINE_HEALTH]);
    expect(metadata('pipelineHealth', PERMISSIONS_KEY)).toMatchObject({
      permissions: ['town.configure'],
    });
  });

  it('answers 503 when civic-briefing cannot say', async () => {
    const { controller } = fixture(() => throwError(() => new Error('down')));
    await expect(controller.pipelineHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('starts a backfill and reads its progress, for town.configure', async () => {
    const status = { running: true, configured: true, towns: ['adel-ga'] };
    const { controller, briefingCalls } = fixture(() => of(status));
    expect(
      await controller.startBackfill({ towns: ['adel-ga'], days: 30 })
    ).toEqual({ data: status });
    expect(await controller.backfillStatus()).toEqual({ data: status });
    expect(briefingCalls).toEqual([
      CivicBriefingCommands.BACKFILL_START,
      CivicBriefingCommands.BACKFILL_STATUS,
    ]);
    for (const name of ['startBackfill', 'backfillStatus'] as const)
      expect(metadata(name, PERMISSIONS_KEY)).toMatchObject({
        permissions: ['town.configure'],
      });
  });

  it('answers 503 when civic-briefing cannot start a backfill', async () => {
    const { controller } = fixture(() => throwError(() => new Error('down')));
    await expect(controller.startBackfill({})).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('confirms a callback as the signed-in operator', async () => {
    const { controller, sent } = fixture();
    await controller.confirmCallback(operator, {
      userId: id,
      localitySlug: 'tifton-ga',
      note: 'Called the clerk.',
    });
    expect(sent).toEqual([
      {
        cmd: CommunityCommands.ConfirmOfficialCallback,
        payload: {
          userId: id,
          localitySlug: 'tifton-ga',
          operator: 'admin-1',
          note: 'Called the clerk.',
        },
      },
    ]);
  });

  it('lists notices, filtered by state when given', async () => {
    const { controller, sent } = fixture();
    await controller.takedownNotices('received');
    await controller.takedownNotices();
    expect(sent.map((s) => s.payload)).toEqual([{ state: 'received' }, {}]);
    expect(sent[0].cmd).toBe(CommunityCommands.ListTakedownNotices);
  });

  it('acts on a notice as the operator', async () => {
    const { controller, sent } = fixture();
    await controller.actOnTakedownNotice(operator, id, {
      action: 'upheld',
      note: 'Valid.',
    });
    expect(sent[0]).toEqual({
      cmd: CommunityCommands.ActOnTakedownNotice,
      payload: {
        noticeId: id,
        action: 'upheld',
        operator: 'admin-1',
        note: 'Valid.',
      },
    });
  });

  it('triggers upkeep and reads density', async () => {
    const { controller, sent } = fixture();
    await controller.rereview();
    await controller.sweepOutcomes();
    await controller.exportPromotions();
    await controller.density();
    expect(sent.map((s) => s.cmd)).toEqual([
      CommunityCommands.Rereview,
      CommunityCommands.SweepOutcomes,
      CommunityCommands.ExportPromotions,
      CommunityCommands.Density,
    ]);
  });

  it.each([
    ['density', 'density.read'],
    ['confirmCallback', 'official.verify'],
    ['takedownNotices', 'takedown.manage'],
    ['actOnTakedownNotice', 'takedown.manage'],
    ['rereview', 'community.maintain'],
    ['sweepOutcomes', 'community.maintain'],
    ['exportPromotions', 'community.maintain'],
  ] as const)('%s requires %s and is not public', (route, permission) => {
    expect(metadata(route, PERMISSIONS_KEY)).toEqual({
      permissions: [permission],
    });
    expect(metadata(route, IS_PUBLIC_KEY)).toBeUndefined();
  });
});
