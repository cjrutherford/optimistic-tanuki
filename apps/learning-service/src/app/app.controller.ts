import { Body, Controller, Get, Post } from '@nestjs/common';
import { ActivityType, Evaluation } from '@optimistic-tanuki/learning-domain';
import { AppService } from './app.service';

interface SubmitAttemptDto {
  userId: string;
  offeringId: string;
  activityId: string;
  activityType: ActivityType;
  submission: unknown;
  isAsync?: boolean;
}

interface RecordEvaluationDto {
  attemptId: string;
  mode: Evaluation['mode'];
  grader: Evaluation['grader'];
  score: number;
  maxScore: number;
  feedback: string;
  rubric?: Evaluation['rubric'];
  humanOverride?: boolean;
}

@Controller('learning')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('programs')
  listPrograms() {
    return this.appService.listPrograms();
  }

  @Post('attempts')
  submitAttempt(@Body() body: SubmitAttemptDto) {
    return this.appService.submitAttempt(body);
  }

  @Post('evaluations')
  recordEvaluation(@Body() body: RecordEvaluationDto) {
    return this.appService.recordEvaluation({
      ...body,
      humanOverride: body.humanOverride ?? false,
    });
  }
}
