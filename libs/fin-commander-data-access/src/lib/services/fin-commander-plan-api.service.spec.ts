import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { FinCommanderPlanApiService } from './fin-commander-plan-api.service';
import { FinCommanderScope } from '../models/fin-commander-scope.model';
import {
  FinCommanderGoal,
  FinCommanderPlan,
  FinCommanderScenario,
} from '../models/fin-commander.models';

describe('FinCommanderPlanApiService', () => {
  let service: FinCommanderPlanApiService;
  let httpMock: HttpTestingController;

  const scope: FinCommanderScope = {
    tenantId: 'tenant-1',
    profileId: 'profile-1',
  };
  const baseUrl = '/api/finance/fin-commander';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [FinCommanderPlanApiService],
    });
    service = TestBed.inject(FinCommanderPlanApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('listPlans', () => {
    it('returns [] without a scope', async () => {
      await expect(
        service.listPlans(undefined as unknown as FinCommanderScope)
      ).resolves.toEqual([]);
    });

    it('fetches plans when scoped', async () => {
      const promise = service.listPlans(scope);
      const req = httpMock.expectOne(`${baseUrl}/plans`);
      expect(req.request.method).toBe('GET');
      req.flush([{ id: 'p1' }]);
      await expect(promise).resolves.toEqual([{ id: 'p1' }]);
    });
  });

  describe('createPlan', () => {
    it('throws without a scope', async () => {
      await expect(
        service.createPlan(
          undefined as unknown as FinCommanderScope,
          {
            name: 'x',
          } as unknown as FinCommanderPlan
        )
      ).rejects.toThrow('An active tenant scope is required to create a plan');
    });

    it('posts the plan fields', async () => {
      const plan = {
        name: 'Retire',
        description: 'desc',
        defaultWorkspace: 'ws',
      } as unknown as FinCommanderPlan;
      const promise = service.createPlan(scope, plan);
      const req = httpMock.expectOne(`${baseUrl}/plan`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'Retire',
        description: 'desc',
        defaultWorkspace: 'ws',
      });
      req.flush({ ...plan, id: 'p1' });
      await expect(promise).resolves.toEqual({ ...plan, id: 'p1' });
    });
  });

  describe('listGoals', () => {
    it('returns [] without a scope or planId', async () => {
      await expect(service.listGoals(scope, '')).resolves.toEqual([]);
      await expect(
        service.listGoals(undefined as unknown as FinCommanderScope, 'p1')
      ).resolves.toEqual([]);
    });

    it('fetches goals for a plan', async () => {
      const promise = service.listGoals(scope, 'p1');
      const req = httpMock.expectOne(`${baseUrl}/plan/p1/goals`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
      await expect(promise).resolves.toEqual([]);
    });
  });

  describe('getCashFlowProjection', () => {
    it('returns null without a scope or planId', async () => {
      await expect(
        service.getCashFlowProjection(scope, '')
      ).resolves.toBeNull();
    });

    it('fetches the projection', async () => {
      const promise = service.getCashFlowProjection(scope, 'p1');
      const req = httpMock.expectOne(`${baseUrl}/plan/p1/projection`);
      req.flush({ months: [] });
      await expect(promise).resolves.toEqual({ months: [] });
    });
  });

  describe('saveGoal', () => {
    it('throws without a scope', async () => {
      await expect(
        service.saveGoal(
          undefined as unknown as FinCommanderScope,
          {
            planId: 'p1',
          } as unknown as FinCommanderGoal
        )
      ).rejects.toThrow('An active tenant scope is required to save a goal');
    });

    it('posts goal fields to the plan', async () => {
      const goal = {
        planId: 'p1',
        name: 'Emergency fund',
        targetAmountCents: 100000,
        currentAmountCents: 5000,
        dueDate: '2027-01-01',
        strategy: 'fixed',
        fundingAccountId: 'acc-1',
      } as unknown as FinCommanderGoal;
      const promise = service.saveGoal(scope, goal);
      const req = httpMock.expectOne(`${baseUrl}/plan/p1/goal`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'Emergency fund',
        targetAmountCents: 100000,
        currentAmountCents: 5000,
        dueDate: '2027-01-01',
        strategy: 'fixed',
        fundingAccountId: 'acc-1',
      });
      req.flush(goal);
      await expect(promise).resolves.toEqual(goal);
    });
  });

  describe('deleteGoal', () => {
    it('does nothing without a scope', async () => {
      await service.deleteGoal(undefined as unknown as FinCommanderScope, 'g1');
    });

    it('sends a delete request', async () => {
      const promise = service.deleteGoal(scope, 'g1');
      const req = httpMock.expectOne(`${baseUrl}/goal/g1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      await promise;
    });
  });

  describe('previewFundingDirective', () => {
    it('returns null without a scope or goalId', async () => {
      await expect(
        service.previewFundingDirective(scope, '')
      ).resolves.toBeNull();
    });

    it('fetches the preview', async () => {
      const promise = service.previewFundingDirective(scope, 'g1');
      const req = httpMock.expectOne(`${baseUrl}/goal/g1/funding-directive`);
      req.flush({ amountCents: 100 });
      await expect(promise).resolves.toEqual({ amountCents: 100 });
    });
  });

  describe('approveFundingDirective', () => {
    it('throws without a scope', async () => {
      await expect(
        service.approveFundingDirective(
          undefined as unknown as FinCommanderScope,
          'g1'
        )
      ).rejects.toThrow('An active tenant scope is required');
    });

    it('posts approval', async () => {
      const promise = service.approveFundingDirective(scope, 'g1');
      const req = httpMock.expectOne(
        `${baseUrl}/goal/g1/funding-directive/approve`
      );
      expect(req.request.method).toBe('POST');
      req.flush({ id: 'fd1' });
      await expect(promise).resolves.toEqual({ id: 'fd1' });
    });
  });

  describe('cancelFundingDirective', () => {
    it('throws without a scope', async () => {
      await expect(
        service.cancelFundingDirective(
          undefined as unknown as FinCommanderScope,
          'g1'
        )
      ).rejects.toThrow('An active tenant scope is required');
    });

    it('posts cancellation', async () => {
      const promise = service.cancelFundingDirective(scope, 'g1');
      const req = httpMock.expectOne(
        `${baseUrl}/goal/g1/funding-directive/cancel`
      );
      expect(req.request.method).toBe('POST');
      req.flush({ id: 'fd1' });
      await expect(promise).resolves.toEqual({ id: 'fd1' });
    });
  });

  describe('listScenarios', () => {
    it('returns [] without a scope or planId', async () => {
      await expect(service.listScenarios(scope, '')).resolves.toEqual([]);
    });

    it('fetches scenarios', async () => {
      const promise = service.listScenarios(scope, 'p1');
      const req = httpMock.expectOne(`${baseUrl}/plan/p1/scenarios`);
      req.flush([]);
      await expect(promise).resolves.toEqual([]);
    });
  });

  describe('saveScenario', () => {
    it('throws without a scope', async () => {
      await expect(
        service.saveScenario(
          undefined as unknown as FinCommanderScope,
          {
            planId: 'p1',
          } as unknown as FinCommanderScenario
        )
      ).rejects.toThrow(
        'An active tenant scope is required to save a scenario'
      );
    });

    it('posts scenario fields', async () => {
      const scenario = {
        planId: 'p1',
        name: 'Base case',
        summary: 'summary',
        assumptions: { rate: 0.05 },
      } as unknown as FinCommanderScenario;
      const promise = service.saveScenario(scope, scenario);
      const req = httpMock.expectOne(`${baseUrl}/plan/p1/scenario`);
      expect(req.request.body).toEqual({
        name: 'Base case',
        summary: 'summary',
        assumptions: { rate: 0.05 },
      });
      req.flush(scenario);
      await expect(promise).resolves.toEqual(scenario);
    });
  });

  describe('deleteScenario', () => {
    it('does nothing without a scope', async () => {
      await service.deleteScenario(
        undefined as unknown as FinCommanderScope,
        's1'
      );
    });

    it('sends a delete request', async () => {
      const promise = service.deleteScenario(scope, 's1');
      const req = httpMock.expectOne(`${baseUrl}/scenario/s1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      await promise;
    });
  });
});
