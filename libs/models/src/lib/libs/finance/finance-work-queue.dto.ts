import { ApiProperty } from '@nestjs/swagger';
import { FinanceWorkspace } from './finance-workspace.type';

export class FinanceEntityRefDto {
  @ApiProperty()
  entityType: 'account' | 'transaction' | 'budget' | 'recurring-item' | 'asset';

  @ApiProperty()
  entityId: string;
}

export class FinanceCoachCardDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  ruleId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  explanation: string;

  @ApiProperty()
  whyItMatters: string;

  @ApiProperty()
  category: 'data-hygiene' | 'cash-pressure' | 'boundary-drift';

  @ApiProperty()
  severity: 'info' | 'warning' | 'action';

  @ApiProperty({ required: false })
  actionLabel?: string;

  @ApiProperty({ required: false })
  actionRoute?: string;

  @ApiProperty({ type: [FinanceEntityRefDto] })
  entityRefs: FinanceEntityRefDto[];
}

export class FinanceWorkQueueDto {
  @ApiProperty()
  workspace: FinanceWorkspace;

  @ApiProperty({ type: [FinanceCoachCardDto] })
  items: FinanceCoachCardDto[];
}
