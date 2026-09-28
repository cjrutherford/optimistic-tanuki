import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import {
  CivicBroadcastSeverity,
  CivicMeetingBody,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { TenantContextGuard } from '../../guards/tenant-context.guard';
import { CivicController } from './civic.controller';

describe('CivicController', () => {
  let controller: CivicController;
  let civicClient: { send: jest.Mock };
  const tenantReq = { tenantId: 'chatham-county' };

  beforeEach(async () => {
    civicClient = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CivicController],
      providers: [
        {
          provide: ServiceTokens.CIVIC_SERVICE,
          useValue: civicClient,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantContextGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CivicController>(CivicController);
  });

  it('reads agendas for the resolved tenant', async () => {
    civicClient.send.mockReturnValue(of([{ id: 'agenda-1' }]));

    const result = await controller.getAgendas(
      'city-council',
      'rezoning',
      '25',
      tenantReq
    );

    expect(civicClient.send).toHaveBeenCalledWith(
      'civic.get_agendas',
      expect.objectContaining({
        tenantId: 'chatham-county',
        meetingBody: 'city-council',
        search: 'rezoning',
        limit: 25,
      })
    );
    expect(result).toEqual([{ id: 'agenda-1' }]);
  });

  it('requires tenant context on public routes', async () => {
    await expect(
      controller.getAgendas(undefined, undefined, undefined, {})
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      controller.getTipProjects(undefined, undefined, {})
    ).rejects.toThrow(NotFoundException);
    expect(civicClient.send).not.toHaveBeenCalled();
  });

  it('validates the spatial bbox before querying', async () => {
    civicClient.send.mockReturnValue(of([]));

    await controller.getTipProjects(
      '-81.5,31.5,-80.5,32.5',
      undefined,
      tenantReq
    );

    expect(civicClient.send).toHaveBeenCalledWith(
      'civic.get_tip_projects',
      expect.objectContaining({
        bbox: [-81.5, 31.5, -80.5, 32.5],
      })
    );

    await expect(
      controller.getTipProjects('not-a-box', undefined, tenantReq)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ingests agendas and publishes broadcasts through civic patterns', async () => {
    civicClient.send.mockReturnValue(of({ id: 'agenda-1' }));
    await controller.ingestAgenda(
      {
        meetingBody: CivicMeetingBody.CITY_COUNCIL,
        meetingDate: '2026-09-01T18:00:00.000Z',
        title: 'Session',
        fileName: 'agenda.pdf',
        fileBase64: 'aGVsbG8=',
      },
      tenantReq
    );
    expect(civicClient.send).toHaveBeenCalledWith(
      'civic.ingest_agenda',
      expect.objectContaining({ tenantId: 'chatham-county' })
    );

    civicClient.send.mockReturnValue(of({ id: 'broadcast-1' }));
    await controller.publishBroadcast(
      {
        severity: CivicBroadcastSeverity.WARNING,
        headline: 'Flood watch',
        body: 'A flood watch is in effect for low-lying roads.',
      },
      tenantReq
    );
    expect(civicClient.send).toHaveBeenCalledWith(
      'civic.broadcast_alert',
      expect.objectContaining({ tenantId: 'chatham-county' })
    );
  });

  it('imports a configured agenda source for the resolved tenant', async () => {
    civicClient.send.mockReturnValue(of({ id: 'agenda-imported' }));
    await controller.importAgendaSource(
      {
        sourceId: 'savannah-council',
        meetingBody: CivicMeetingBody.CITY_COUNCIL,
        meetingDate: '2026-09-01T18:00:00.000Z',
        title: 'September council session',
      },
      tenantReq
    );

    expect(civicClient.send).toHaveBeenCalledWith(
      'civic.import_agenda_source',
      expect.objectContaining({
        tenantId: 'chatham-county',
        sourceId: 'savannah-council',
      })
    );
  });

  it('streams the current broadcasts then only fresh ones', async () => {
    jest.useFakeTimers();
    try {
      const first = [{ id: 'b-1', headline: 'One' }];
      const second = [{ id: 'b-1', headline: 'One' }];
      const third = [
        { id: 'b-1', headline: 'One' },
        { id: 'b-2', headline: 'Two' },
      ];
      civicClient.send
        .mockReturnValueOnce(of(first))
        .mockReturnValueOnce(of(second))
        .mockReturnValue(of(third));

      const seen: Array<{ broadcasts: unknown[]; fresh: unknown[] }> = [];
      const subscription = controller
        .streamBroadcasts(tenantReq)
        .subscribe((event) =>
          seen.push(
            (
              event as unknown as {
                data: { broadcasts: unknown[]; fresh: unknown[] };
              }
            ).data
          )
        );

      await jest.advanceTimersByTimeAsync(1000);
      expect(seen).toHaveLength(1);
      expect(seen[0]).toEqual({ broadcasts: first, fresh: first });

      await jest.advanceTimersByTimeAsync(15000);
      expect(seen).toHaveLength(1);

      await jest.advanceTimersByTimeAsync(15000);
      expect(seen).toHaveLength(2);
      expect(seen[1]).toEqual({
        broadcasts: third,
        fresh: [{ id: 'b-2', headline: 'Two' }],
      });
      subscription.unsubscribe();
    } finally {
      jest.useRealTimers();
    }
  });

  it('propagates civic failures without fabricating data', async () => {
    civicClient.send.mockReturnValue(throwError(() => new Error('civic down')));

    await expect(
      controller.getAgendas(undefined, undefined, undefined, tenantReq)
    ).rejects.toThrow('civic down');
  });
});
