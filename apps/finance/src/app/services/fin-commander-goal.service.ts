import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import DOMPurify from 'isomorphic-dompurify';
import {
  CreateFinCommanderGoalDto,
  FinCommanderGoalFundingDirective,
  UpdateFinCommanderGoalDto,
} from '@optimistic-tanuki/constants';
import { FinCommanderGoalEntity } from '../../entities';
import { Account } from '../../entities/account.entity';
import {
  FinanceScope,
  withScopedFindManyOptions,
  withScopedFindOneOptions,
} from './finance-scope';

@Injectable()
export class FinCommanderGoalService {
  constructor(
    @Inject(getRepositoryToken(FinCommanderGoalEntity))
    private readonly goalRepo: Repository<FinCommanderGoalEntity>,
    @Inject(getRepositoryToken(Account))
    private readonly accountRepo: Repository<Account>
  ) {}

  private async assertFundingAccount(
    fundingAccountId: string | undefined | null,
    scope: { tenantId?: string; appScope?: string }
  ): Promise<void> {
    if (!fundingAccountId) {
      return;
    }

    const account = await this.accountRepo.findOne({
      where: {
        id: fundingAccountId,
        tenantId: scope.tenantId,
        appScope: scope.appScope ?? 'finance',
        isActive: true,
      },
    });
    if (!account) {
      throw new NotFoundException('Funding account not found');
    }
  }

  async getFundingDirective(
    goal: Pick<
      FinCommanderGoalEntity,
      'fundingAccountId' | 'targetAmountCents' | 'dueDate'
    >,
    scope: { tenantId?: string; appScope?: string },
    asOf = new Date()
  ): Promise<FinCommanderGoalFundingDirective | null> {
    if (!goal.fundingAccountId) {
      return null;
    }

    const account = await this.accountRepo.findOne({
      where: {
        id: goal.fundingAccountId,
        tenantId: scope.tenantId,
        appScope: scope.appScope ?? 'finance',
        isActive: true,
      },
    });
    if (!account) {
      return null;
    }

    const fundingAccountBalanceCents = Math.round(
      Number(account.balance) * 100
    );
    const remainingAmountCents = Math.max(
      0,
      goal.targetAmountCents - fundingAccountBalanceCents
    );
    const dueDate = new Date(`${goal.dueDate}T00:00:00.000Z`);
    const monthsUntilDue =
      (dueDate.getUTCFullYear() - asOf.getUTCFullYear()) * 12 +
      dueDate.getUTCMonth() -
      asOf.getUTCMonth() +
      1;
    const isOverdue =
      dueDate.getTime() <
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
    const monthsRemaining = Math.max(1, monthsUntilDue);

    return {
      fundingAccountId: account.id,
      fundingAccountName: account.name,
      fundingAccountBalanceCents,
      remainingAmountCents,
      monthsRemaining,
      requiredMonthlyContributionCents: Math.ceil(
        remainingAmountCents / monthsRemaining
      ),
      isOverdue,
    };
  }

  private sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }

  /** Money is always integer cents on the wire and in storage — never a float. */
  private assertIntegerCents(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException(
        `${field} must be a non-negative integer number of cents`
      );
    }
  }

  async create(
    createGoalDto: CreateFinCommanderGoalDto & { tenantId: string }
  ): Promise<FinCommanderGoalEntity> {
    this.assertIntegerCents(
      createGoalDto.targetAmountCents,
      'targetAmountCents'
    );
    const currentAmountCents = createGoalDto.currentAmountCents ?? 0;
    this.assertIntegerCents(currentAmountCents, 'currentAmountCents');
    await this.assertFundingAccount(
      createGoalDto.fundingAccountId,
      createGoalDto
    );

    const goal = this.goalRepo.create({
      ...createGoalDto,
      currentAmountCents,
      name: this.sanitizeContent(createGoalDto.name),
      strategy: createGoalDto.strategy
        ? this.sanitizeContent(createGoalDto.strategy)
        : '',
    });
    return await this.goalRepo.save(goal);
  }

  async findAll(
    scope?: FinanceScope,
    options?: FindManyOptions<FinCommanderGoalEntity>
  ): Promise<FinCommanderGoalEntity[]> {
    return await this.goalRepo.find(withScopedFindManyOptions(scope, options));
  }

  async findOne(
    id: string,
    scope?: FinanceScope,
    options?: FindOneOptions<FinCommanderGoalEntity>
  ): Promise<FinCommanderGoalEntity | null> {
    return await this.goalRepo.findOne(
      withScopedFindOneOptions(id, scope, options)
    );
  }

  async update(
    id: string,
    updateGoalDto: UpdateFinCommanderGoalDto,
    scope?: FinanceScope
  ): Promise<FinCommanderGoalEntity> {
    const goal = await this.findOne(id, scope);
    if (!goal) {
      throw new NotFoundException(`Goal with ID ${id} not found`);
    }

    const updatedData: Partial<FinCommanderGoalEntity> = {};
    if (updateGoalDto.name) {
      updatedData.name = this.sanitizeContent(updateGoalDto.name);
    }
    if (updateGoalDto.targetAmountCents !== undefined) {
      this.assertIntegerCents(
        updateGoalDto.targetAmountCents,
        'targetAmountCents'
      );
      updatedData.targetAmountCents = updateGoalDto.targetAmountCents;
    }
    if (updateGoalDto.currentAmountCents !== undefined) {
      this.assertIntegerCents(
        updateGoalDto.currentAmountCents,
        'currentAmountCents'
      );
      updatedData.currentAmountCents = updateGoalDto.currentAmountCents;
    }
    if (updateGoalDto.dueDate) {
      updatedData.dueDate = updateGoalDto.dueDate;
    }
    if (updateGoalDto.strategy !== undefined) {
      updatedData.strategy = this.sanitizeContent(updateGoalDto.strategy);
    }
    if (updateGoalDto.fundingAccountId !== undefined) {
      await this.assertFundingAccount(
        updateGoalDto.fundingAccountId,
        scope ?? {}
      );
      updatedData.fundingAccountId = updateGoalDto.fundingAccountId;
    }

    await this.goalRepo.update(id, updatedData);
    return await this.findOne(id, scope);
  }

  async remove(id: string, scope?: FinanceScope): Promise<void> {
    const goal = await this.findOne(id, scope);
    if (!goal) {
      throw new NotFoundException(`Goal with ID ${id} not found`);
    }

    await this.goalRepo.delete(id);
  }
}
