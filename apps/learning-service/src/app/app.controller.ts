import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LearningCommands } from '@optimistic-tanuki/constants';
import { ActivityType, Evaluation } from '@optimistic-tanuki/learning-domain';
import { LessonProgress } from '@optimistic-tanuki/learning-domain';
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

  @MessagePattern({ cmd: LearningCommands.GetLesson })
  getLesson(@Payload() body: { trackId: string; lessonId: string }) {
    return this.appService.getLesson(body.trackId, body.lessonId);
  }

  @MessagePattern({ cmd: LearningCommands.GetProgress })
  getProgress(@Payload() body: { userId: string }) {
    return this.appService.getProgress(body.userId);
  }

  @MessagePattern({ cmd: LearningCommands.SaveLessonProgress })
  saveProgress(
    @Payload()
    body: {
      userId: string;
      progress: Omit<LessonProgress, 'updatedAt'>;
    }
  ) {
    return this.appService.saveProgress(body.userId, body.progress);
  }

  @MessagePattern({ cmd: LearningCommands.RunCode })
  runCode(@Payload() body: { activityId: string; code: string }) {
    return this.appService.runCode(body.activityId, body.code);
  }

  @MessagePattern({ cmd: LearningCommands.GetDashboard })
  getDashboard(@Payload() body: { userId?: string }) {
    return this.appService.getDashboard(body.userId);
  }

  @MessagePattern({ cmd: LearningCommands.SubmitExercise })
  submitExercise(
    @Payload() body: { userId: string; activityId: string; code: string }
  ) {
    return this.appService.submitExercise(
      body.userId,
      body.activityId,
      body.code
    );
  }
}
