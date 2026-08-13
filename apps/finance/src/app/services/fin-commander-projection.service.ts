import { Injectable } from '@nestjs/common';
import {
  FinCommanderCashFlowEvent,
  FinCommanderCashFlowProjection,
} from '@optimistic-tanuki/constants';
import { FinanceWorkspace } from '@optimistic-tanuki/models';
import { FinanceScope } from './finance-scope';
import { AccountService } from './account.service';
import { RecurringItemService } from './recurring-item.service';
import { FinCommanderGoalService } from './fin-commander-goal.service';
import { FinCommanderPlanService } from './fin-commander-plan.service';

const HORIZON_DAYS = 90;

@Injectable()
export class FinCommanderProjectionService {
  constructor(
    private readonly plans: FinCommanderPlanService,
    private readonly accounts: AccountService,
    private readonly recurring: RecurringItemService,
    private readonly goals: FinCommanderGoalService
  ) {}

  private isoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private utcDate(value: Date | string): Date {
    const parsed = new Date(value);
    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate()
      )
    );
  }

  private nextOccurrence(date: Date, cadence: string): Date | null {
    const next = new Date(date);
    switch (cadence) {
      case 'weekly':
        next.setUTCDate(next.getUTCDate() + 7);
        break;
      case 'monthly':
        next.setUTCMonth(next.getUTCMonth() + 1);
        break;
      case 'quarterly':
        next.setUTCMonth(next.getUTCMonth() + 3);
        break;
      case 'yearly':
        next.setUTCFullYear(next.getUTCFullYear() + 1);
        break;
      default:
        return null;
    }
    return next;
  }

  async getProjection(
    planId: string,
    scope: FinanceScope,
    asOf = new Date()
  ): Promise<FinCommanderCashFlowProjection> {
    await this.plans.assertAccess(planId, scope);
    const plan = await this.plans.findOne(planId, scope);
    const workspace = plan!.defaultWorkspace as FinanceWorkspace;
    const start = this.utcDate(asOf);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + HORIZON_DAYS - 1);
    const [accounts, recurringItems, goals] = await Promise.all([
      this.accounts.findAll(scope),
      this.recurring.findAll(scope),
      this.goals.findAll(scope, { where: { planId } }),
    ]);
    const workspaceAccounts = accounts.filter(
      (account) => account.isActive && account.workspace === workspace
    );
    const openingBalanceCents = workspaceAccounts.reduce(
      (sum, account) => sum + Math.round(Number(account.balance) * 100),
      0
    );
    const events: FinCommanderCashFlowEvent[] = [];

    for (const item of recurringItems.filter(
      (item) => item.isActive && item.workspace === workspace
    )) {
      let occurrence = this.utcDate(item.nextDueDate);
      while (occurrence < start) {
        const next = this.nextOccurrence(occurrence, item.cadence);
        if (!next) break;
        occurrence = next;
      }
      while (occurrence <= end) {
        events.push({
          date: this.isoDate(occurrence),
          amountCents:
            Math.round(Number(item.amount) * 100) *
            (item.type === 'credit' ? 1 : -1),
          kind:
            item.type === 'credit' ? 'recurring-income' : 'recurring-expense',
          label: item.name,
          sourceId: item.id,
        });
        const next = this.nextOccurrence(occurrence, item.cadence);
        if (!next) break;
        occurrence = next;
      }
    }

    for (const goal of goals) {
      const directive = await this.goals.getFundingDirective(
        goal,
        scope,
        start
      );
      if (!directive || directive.requiredMonthlyContributionCents <= 0)
        continue;
      for (
        let date = new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)
        );
        date <= end;
        date.setUTCMonth(date.getUTCMonth() + 1)
      ) {
        events.push({
          date: this.isoDate(date),
          amountCents: -directive.requiredMonthlyContributionCents,
          kind: 'goal-funding',
          label: `Fund ${goal.name}`,
          sourceId: goal.id,
        });
      }
    }
    events.sort(
      (a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label)
    );
    const dailyEventTotals = events.reduce((totals, event) => {
      totals.set(event.date, (totals.get(event.date) ?? 0) + event.amountCents);
      return totals;
    }, new Map<string, number>());
    let balance = openingBalanceCents;
    const dailyBalances = Array.from({ length: HORIZON_DAYS }, (_, offset) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + offset);
      const dateString = this.isoDate(date);
      balance += dailyEventTotals.get(dateString) ?? 0;
      return { date: dateString, closingBalanceCents: balance };
    });
    return {
      calculatedAt: asOf.toISOString(),
      workspace,
      openingBalanceCents,
      projectedBalanceCents: balance,
      horizonDays: HORIZON_DAYS,
      events,
      dailyBalances,
    };
  }
}
