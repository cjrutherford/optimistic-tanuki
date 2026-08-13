import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRecurringItemDto } from '@optimistic-tanuki/models';
import { FinCommanderGoalEntity, RecurringItem } from '../../entities';
import { FinCommanderFundingDirectiveEntity } from '../../entities/fin-commander-funding-directive.entity';
import { FinanceScope, withScopedFindOneOptions } from './finance-scope';
import { FinCommanderGoalService } from './fin-commander-goal.service';

@Injectable()
export class FinCommanderFundingDirectiveService {
  constructor(
    @Inject(getRepositoryToken(FinCommanderFundingDirectiveEntity))
    private readonly directiveRepo: Repository<FinCommanderFundingDirectiveEntity>,
    @Inject(getRepositoryToken(FinCommanderGoalEntity))
    private readonly goalRepo: Repository<FinCommanderGoalEntity>,
    @Inject(getRepositoryToken(RecurringItem))
    private readonly recurringRepo: Repository<RecurringItem>,
    private readonly goalService: FinCommanderGoalService
  ) {}

  private async findGoal(
    goalId: string,
    scope: FinanceScope
  ): Promise<FinCommanderGoalEntity> {
    const goal = await this.goalRepo.findOne(
      withScopedFindOneOptions(goalId, scope)
    );
    if (!goal) {
      throw new NotFoundException(`Goal with ID ${goalId} not found`);
    }
    return goal;
  }

  private async findExisting(goalId: string, scope: FinanceScope) {
    return this.directiveRepo.findOne({
      where: {
        goalId,
        tenantId: scope.tenantId,
        appScope: scope.appScope ?? 'finance',
      },
    });
  }

  async preview(goalId: string, scope: FinanceScope) {
    const goal = await this.findGoal(goalId, scope);
    return this.goalService.getFundingApprovalPreview(goal, scope);
  }

  async approve(
    goalId: string,
    scope: FinanceScope
  ): Promise<FinCommanderFundingDirectiveEntity> {
    const goal = await this.findGoal(goalId, scope);
    const existing = await this.findExisting(goalId, scope);
    if (existing) {
      return existing;
    }

    const preview = await this.goalService.getFundingApprovalPreview(
      goal,
      scope
    );
    if (!preview) {
      throw new NotFoundException(
        'Funding account not found or funding directive unavailable'
      );
    }

    const recurring = await this.recurringRepo.save(
      this.recurringRepo.create({
        name: `Funding instruction: ${goal.name}`,
        amount: preview.amountCents / 100,
        type: 'goal-funding',
        category: 'savings',
        cadence: preview.cadence,
        nextDueDate: new Date(`${preview.startDate}T00:00:00.000Z`),
        status: 'scheduled',
        payeeOrVendor: null,
        notes:
          'Forecast/instruction only. Approval does not post a transaction or change account balances.',
        accountId: preview.fundingAccountId,
        fundingDirectiveId: null,
        userId: goal.userId,
        profileId: goal.profileId,
        tenantId: goal.tenantId,
        appScope: goal.appScope,
        workspace: 'personal',
        isActive: true,
      } as CreateRecurringItemDto & { fundingDirectiveId: null })
    );

    const directive = await this.directiveRepo.save(
      this.directiveRepo.create({
        goalId: goal.id,
        recurringItemId: recurring.id,
        amountCents: preview.amountCents,
        cadence: preview.cadence,
        startDate: preview.startDate,
        fundingAccountId: preview.fundingAccountId,
        status: 'approved',
        userId: goal.userId,
        profileId: goal.profileId,
        tenantId: goal.tenantId,
        appScope: goal.appScope,
        approvedAt: new Date(),
        approvedByUserId: scope.userId ?? goal.userId,
        cancelledAt: null,
        cancelledByUserId: null,
      })
    );

    await this.recurringRepo.update(recurring.id, {
      fundingDirectiveId: directive.id,
    });
    await this.goalRepo.update(goal.id, { fundingDirectiveId: directive.id });
    return { ...directive, recurringItemId: recurring.id };
  }

  async cancel(
    goalId: string,
    scope: FinanceScope
  ): Promise<FinCommanderFundingDirectiveEntity> {
    await this.findGoal(goalId, scope);
    const directive = await this.findExisting(goalId, scope);
    if (!directive) {
      throw new NotFoundException('Funding directive not found');
    }

    if (directive.recurringItemId) {
      const recurring = await this.recurringRepo.findOne({
        where: {
          id: directive.recurringItemId,
          tenantId: scope.tenantId,
          appScope: scope.appScope ?? 'finance',
        },
      });
      if (recurring) {
        await this.recurringRepo.update(recurring.id, {
          isActive: false,
          status: 'cancelled',
        });
      }
    }
    await this.directiveRepo.update(directive.id, {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledByUserId: scope.userId,
    });
    return {
      ...directive,
      status: 'cancelled',
      cancelledByUserId: scope.userId,
    };
  }
}
