import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LearningCommands } from '@optimistic-tanuki/constants';
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

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: LearningCommands.ListPrograms })
  listPrograms() {
    return this.appService.listPrograms();
  }

  @MessagePattern({ cmd: LearningCommands.SubmitAttempt })
  submitAttempt(@Payload() body: SubmitAttemptDto) {
    return this.appService.submitAttempt(body);
  }

  @MessagePattern({ cmd: LearningCommands.RecordEvaluation })
  recordEvaluation(@Payload() body: RecordEvaluationDto) {
    return this.appService.recordEvaluation({
      ...body,
      humanOverride: body.humanOverride ?? false,
    });
  }
}

