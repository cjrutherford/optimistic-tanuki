import { ApiProperty } from '@nestjs/swagger';
import { FinanceWorkspace } from './finance-workspace.type';
import { FinanceCoachCardDto } from './finance-work-queue.dto';

export class FinanceSummaryMetricsDto {
  @ApiProperty()
  accountCount: number;

  @ApiProperty()
  budgetCount: number;

  @ApiProperty()
  totalBalance: number;

  @ApiProperty()
  monthlySpend: number;

  @ApiProperty()
  assetValue: number;

  @ApiProperty()
  liabilityValue: number;

  @ApiProperty()
  netWorth: number;

  @ApiProperty()
  budgetsAtRiskCount: number;

  @ApiProperty()
  upcomingRecurringCount: number;
}

export class FinanceWorkspaceSummaryDto {
  @ApiProperty()
  workspace: FinanceWorkspace;

  @ApiProperty()
  headline: string;

  @ApiProperty({ type: FinanceSummaryMetricsDto })
  metrics: FinanceSummaryMetricsDto;

  @ApiProperty({ type: [FinanceCoachCardDto] })
  coachCards: FinanceCoachCardDto[];
}
