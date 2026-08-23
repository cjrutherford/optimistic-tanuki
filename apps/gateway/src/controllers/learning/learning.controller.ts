import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { LearningCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { isNotEnrolled } from '@optimistic-tanuki/learning-domain';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { LearningProfileResolver } from './learning-profile.resolver';

@Controller('learning')
export class LearningController {
  constructor(
    @Inject(ServiceTokens.LEARNING_SERVICE)
    private readonly learningService: ClientProxy,
    private readonly learningProfiles: LearningProfileResolver
  ) {}

  @Get('programs')
  async listPrograms() {
    return await firstValueFrom(
      this.learningService.send({ cmd: LearningCommands.ListPrograms }, {})
    );
  }

  @Public()
  @UseGuards(AuthGuard)
  @Get('dashboard')
  async getDashboard(@Req() req: { user?: { userId?: string } }) {
    const userId = req.user?.userId;
    const profileId = userId
      ? await this.learningProfiles.resolveProfileId(userId)
      : undefined;
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.GetDashboard },
        { profileId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @Post('attempts')
  async submitAttempt(
    @Body() body: Record<string, unknown>,
    @Req() req: { user: { userId: string } }
  ) {
    // The acting user always comes from the verified token. A userId in the
    // body would let a caller submit an attempt as someone else.
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.SubmitAttempt },
        { ...body, userId: req.user.userId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @Post('evaluations')
  async recordEvaluation(
    @Body() body: Record<string, unknown>,
    @Req() req: { user: { userId: string } }
  ) {
    // Recording who graded an attempt gives an audit trail for scores.
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.RecordEvaluation },
        { ...body, recordedByUserId: req.user.userId }
      )
    );
  }

  @Get('programs/:trackId/lessons/:lessonId')
  async getLesson(
    @Param('trackId') trackId: string,
    @Param('lessonId') lessonId: string
  ) {
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.GetLesson },
        { trackId, lessonId }
      )
    );
  }

  // Anonymous visitors get an empty list rather than a 401, so the lesson page
  // renders for everyone and only the saving depends on a session.
  @Public()
  @UseGuards(AuthGuard)
  @Get('me/progress')
  async getMyProgress(@Req() req: { user?: { userId?: string } }) {
    const userId = req.user?.userId;
    if (!userId) return [];
    const profileId = await this.learningProfiles.resolveProfileId(userId);
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.GetProgress },
        { profileId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @Put('me/progress')
  async saveMyProgress(
    @Req() req: { user: { userId: string } },
    @Body() progress: unknown
  ) {
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.SaveLessonProgress },
        { userId: req.user.userId, profileId, progress }
      )
    );
  }

  // Running code is compute and must be attributable to a session, even
  // though a plain run does not record anything against the learner.
  @UseGuards(AuthGuard)
  @Post('runs')
  async runCode(@Body() body: { activityId: string; code: string }) {
    return await firstValueFrom(
      this.learningService.send({ cmd: LearningCommands.RunCode }, body)
    );
  }

  @UseGuards(AuthGuard)
  @Post('exercises/:activityId/submit')
  async submitExercise(
    @Param('activityId') activityId: string,
    @Body() body: { code: string },
    @Req() req: { user: { userId: string } }
  ) {
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    // A learner who has not enrolled gets a conflict naming the offering, so
    // the client can offer to enrol rather than reporting a failure.
    return await this.asConflictWhenNotEnrolled(
      firstValueFrom(
        this.learningService.send(
          { cmd: LearningCommands.SubmitExercise },
          {
            userId: req.user.userId,
            profileId,
            activityId,
            code: body.code,
          }
        )
      )
    );
  }

  /**
   * Turns the service's not-enrolled refusal into a 409 carrying the offering.
   *
   * Enrolment is explicit on purpose: taking a course is a decision, not a
   * side effect of pressing Submit. The client needs to tell this apart from
   * a real failure, and a bare 500 would not let it.
   */
  private async asConflictWhenNotEnrolled<T>(work: Promise<T>): Promise<T> {
    try {
      return await work;
    } catch (error) {
      const payload = (error as { error?: unknown })?.error ?? error;
      if (isNotEnrolled(payload)) throw new ConflictException(payload);
      throw error;
    }
  }

  @UseGuards(AuthGuard)
  @Post('enrolments')
  async enrol(
    @Body() body: { offeringId: string },
    @Req() req: { user: { userId: string } }
  ) {
    // The profile always comes from the resolver, never the body, so a
    // caller cannot enrol someone else by supplying their profileId.
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.Enrol },
        { profileId, offeringId: body.offeringId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @Delete('enrolments/:offeringId')
  async withdraw(
    @Param('offeringId') offeringId: string,
    @Req() req: { user: { userId: string } }
  ) {
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.Withdraw },
        { profileId, offeringId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @Get('me/enrolments')
  async getMyEnrolments(@Req() req: { user: { userId: string } }) {
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.ListMyEnrolments },
        { profileId }
      )
    );
  }
}
