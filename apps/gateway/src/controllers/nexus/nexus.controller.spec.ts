import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantContextGuard } from '../../guards/tenant-context.guard';
import { NexusController } from './nexus.controller';

describe('NexusController', () => {
  let controller: NexusController;
  let planningClient: { send: jest.Mock };
  const tenantReq = { tenantId: 'nexus-builder' };
  const projectId = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    planningClient = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NexusController],
      providers: [
        {
          provide: ServiceTokens.PROJECT_PLANNING_SERVICE,
          useValue: planningClient,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantContextGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NexusController>(NexusController);
  });

  it('reads milestones for the resolved tenant', async () => {
    planningClient.send.mockReturnValue(of([{ id: 'm-1', delayed: false }]));

    const result = await controller.getMilestones(projectId, tenantReq);

    expect(planningClient.send).toHaveBeenCalledWith('nexus.get_milestones', {
      tenantId: 'nexus-builder',
      projectId,
    });
    expect(result).toEqual([{ id: 'm-1', delayed: false }]);
  });

  it('requires tenant context on every route', async () => {
    await expect(
      controller.getMilestones(projectId, {})
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.getDrawings(projectId, {})).rejects.toThrow(
      NotFoundException
    );
    await expect(controller.getChangeOrders(projectId, {})).rejects.toThrow(
      NotFoundException
    );
    expect(planningClient.send).not.toHaveBeenCalled();
  });

  it('creates milestones and registers drawings through planning', async () => {
    planningClient.send.mockReturnValue(of({ id: 'm-1' }));

    await controller.createMilestone(
      projectId,
      {
        phase: 'Foundation',
        plannedStart: '2026-01-05T08:00:00.000Z',
        plannedEnd: '2026-02-05T17:00:00.000Z',
      },
      tenantReq
    );

    expect(planningClient.send).toHaveBeenCalledWith(
      'nexus.create_milestone',
      expect.objectContaining({ tenantId: 'nexus-builder', projectId })
    );

    planningClient.send.mockReturnValue(of({ drawings: [] }));
    await controller.registerDrawing(
      projectId,
      {
        title: 'Plan',
        version: 'C1',
        storageKey: 'drawings/plan.pdf',
        sha256: 'a'.repeat(64),
      },
      tenantReq
    );

    expect(planningClient.send).toHaveBeenCalledWith(
      'nexus.register_drawing',
      expect.objectContaining({ tenantId: 'nexus-builder', projectId })
    );
  });

  it('patches a milestone through the planning service', async () => {
    planningClient.send.mockReturnValue(of({ id: 'm-1', status: 'completed' }));

    const result = await controller.updateMilestone(
      'm-1',
      { progressPercent: 100 },
      tenantReq
    );

    expect(planningClient.send).toHaveBeenCalledWith('nexus.update_milestone', {
      tenantId: 'nexus-builder',
      id: 'm-1',
      progressPercent: 100,
    });
    expect(result).toEqual({ id: 'm-1', status: 'completed' });
  });

  it('pins the path project onto photo and change-order payloads', async () => {
    planningClient.send.mockReturnValue(of({ id: 'photo-1' }));

    await controller.uploadPhoto(
      projectId,
      {
        projectId: 'attacker-project',
        fileName: 'pour.jpg',
        mimeType: 'image/jpeg',
        fileBase64: 'aGVsbG8=',
      },
      tenantReq
    );

    expect(planningClient.send).toHaveBeenCalledWith(
      'nexus.upload_inspection_photo',
      expect.objectContaining({
        tenantId: 'nexus-builder',
        projectId,
      })
    );

    planningClient.send.mockReturnValue(of({ id: 'co-1' }));
    await controller.submitChangeOrder(
      projectId,
      {
        projectId: 'attacker-project',
        title: 'Extra work performed',
        description: 'Additional trenching beyond the planned scope.',
        amountCents: 100,
        signatures: [],
      },
      tenantReq
    );

    expect(planningClient.send).toHaveBeenCalledWith(
      'nexus.submit_change_order',
      expect.objectContaining({
        tenantId: 'nexus-builder',
        projectId,
      })
    );
  });

  it('rejects a transition without a target state', async () => {
    await expect(
      controller.transitionChangeOrder('co-1', {}, tenantReq)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(planningClient.send).not.toHaveBeenCalled();
  });

  it('streams the signed change order PDF as a download', async () => {
    const pdf = Buffer.from('%PDF-1.7 signed');
    planningClient.send.mockReturnValue(
      of({
        fileName: 'change-order-co-1.pdf',
        mimeType: 'application/pdf',
        fileBase64: pdf.toString('base64'),
      })
    );
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as never;

    await controller.downloadChangeOrderDocument('co-1', tenantReq, response);

    const headers = Object.fromEntries(
      (
        response as unknown as { setHeader: jest.Mock }
      ).setHeader.mock.calls.map(([name, value]: [string, string]) => [
        name,
        value,
      ])
    );
    expect(headers['Content-Type']).toBe('application/pdf');
    expect(headers['Content-Disposition']).toContain('change-order-co-1.pdf');
    expect(headers['Cache-Control']).toBe('no-store');
  });

  it('propagates planning service failures without fabricating data', async () => {
    planningClient.send.mockReturnValue(
      throwError(() => new Error('planning down'))
    );

    await expect(
      controller.getMilestones(projectId, tenantReq)
    ).rejects.toThrow('planning down');
  });
});
