import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LearningCommands } from '@optimistic-tanuki/constants';
import {
  ActivityType,
  DraftOfferingInput,
  Evaluation,
} from '@optimistic-tanuki/learning-domain';
import { LessonProgress } from '@optimistic-tanuki/learning-domain';
import { AppService } from './app.service';
import { OfferingContentPatch } from './learning.repository';

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
  /** The gateway supplies this from the verified token. */
  recordedByUserId?: string;
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
  getProgress(@Payload() body: { profileId: string }) {
    return this.appService.getProgress(body.profileId);
  }

  @MessagePattern({ cmd: LearningCommands.SaveLessonProgress })
  saveProgress(
    @Payload()
    body: {
      profileId: string;
      userId: string;
      progress: Omit<LessonProgress, 'updatedAt'>;
    }
  ) {
    return this.appService.saveProgress(
      body.profileId,
      body.userId,
      body.progress
    );
  }

  @MessagePattern({ cmd: LearningCommands.RunCode })
  runCode(@Payload() body: { activityId: string; code: string }) {
    return this.appService.runCode(body.activityId, body.code);
  }

  @MessagePattern({ cmd: LearningCommands.GetDashboard })
  getDashboard(@Payload() body: { profileId?: string }) {
    return this.appService.getDashboard(body.profileId);
  }

  @MessagePattern({ cmd: LearningCommands.SubmitExercise })
  submitExercise(
    @Payload()
    body: {
      profileId: string;
      userId: string;
      activityId: string;
      code: string;
    }
  ) {
    return this.appService.submitExercise(
      body.profileId,
      body.userId,
      body.activityId,
      body.code
    );
  }

  @MessagePattern({ cmd: LearningCommands.Enrol })
  enrol(@Payload() body: { profileId: string; offeringId: string }) {
    return this.appService.enrol(body.profileId, body.offeringId);
  }

  @MessagePattern({ cmd: LearningCommands.Withdraw })
  withdraw(@Payload() body: { profileId: string; offeringId: string }) {
    return this.appService.withdraw(body.profileId, body.offeringId);
  }

  @MessagePattern({ cmd: LearningCommands.ListMyEnrolments })
  listMyEnrolments(@Payload() body: { profileId: string }) {
    return this.appService.listEnrolments(body.profileId);
  }

  @MessagePattern({ cmd: LearningCommands.CreateOffering })
  createOffering(
    @Payload() body: { profileId: string; input: DraftOfferingInput }
  ) {
    return this.appService.createOffering(body.profileId, body.input);
  }

  @MessagePattern({ cmd: LearningCommands.UpdateOffering })
  updateOffering(
    @Payload() body: { offeringId: string; patch: OfferingContentPatch }
  ) {
    return this.appService.updateOffering(body.offeringId, body.patch);
  }

  @MessagePattern({ cmd: LearningCommands.DeleteOffering })
  deleteOffering(@Payload() body: { offeringId: string }) {
    return this.appService.deleteOffering(body.offeringId);
  }

  @MessagePattern({ cmd: LearningCommands.GetOfferingOwnership })
  getOfferingOwnership(@Payload() body: { offeringId: string }) {
    return this.appService.getOfferingOwnership(body.offeringId);
  }

  @MessagePattern({ cmd: LearningCommands.SetCoEditors })
  setCoEditors(
    @Payload() body: { offeringId: string; coEditorProfileIds: string[] }
  ) {
    return this.appService.setCoEditors(
      body.offeringId,
      body.coEditorProfileIds
    );
  }
}
