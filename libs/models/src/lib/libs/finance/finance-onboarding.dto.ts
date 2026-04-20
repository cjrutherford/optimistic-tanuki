import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn } from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export class FinanceOnboardingChecklistItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  complete: boolean;
}

export class FinanceOnboardingStateDto {
  @ApiProperty()
  requiresOnboarding: boolean;

  @ApiProperty({ type: [String] })
  availableWorkspaces: FinanceWorkspace[];

  @ApiProperty({ type: [FinanceOnboardingChecklistItemDto] })
  checklist: FinanceOnboardingChecklistItemDto[];
}

export class BootstrapFinanceWorkspaceDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsIn(['personal', 'business'], { each: true })
  workspaces: Array<'personal' | 'business'>;
}
