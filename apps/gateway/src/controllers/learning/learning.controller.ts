import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { LearningCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  DraftOfferingInput,
  isLessonNotFound,
  isNotEnrolled,
  PublicationStatusSchema,
} from '@optimistic-tanuki/learning-domain';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { LearningProfileResolver } from './learning-profile.resolver';
import { OfferingAuthorizationService } from './offering-authorization.service';

@Controller('learning')
export class LearningController {
  constructor(
    @Inject(ServiceTokens.LEARNING_SERVICE)
    private readonly learningService: ClientProxy,
    private readonly learningProfiles: LearningProfileResolver,
    private readonly offeringAuthorization: OfferingAuthorizationService
  ) {}

  /**
   * The catalog, as this caller should see it.
   *
   * Anonymous visitors see published courses. A signed-in author also sees
   * their own drafts, and the people who answer for the platform see every
   * draft, so nobody has to publish a half-written course to work on it.
   */
  @Public()
  @UseGuards(AuthGuard)
  @Get('programs')
  async listPrograms(
    @Req() req: { user?: { userId?: string; profileId?: string } }
  ) {
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.ListCatalog },
        await this.resolveViewer(req)
      )
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

  // Open to anonymous readers, like the catalog, and gated the same way: an
  // unpublished course is not readable just because somebody knows its ids.
  @Public()
  @UseGuards(AuthGuard)
  @Get('programs/:trackId/lessons/:lessonId')
  async getLesson(
    @Param('trackId') trackId: string,
    @Param('lessonId') lessonId: string,
    @Req() req: { user?: { userId?: string; profileId?: string } }
  ) {
    const viewer = await this.resolveViewer(req);
    return await this.asNotFoundWhenUnknown(() =>
      firstValueFrom(
        this.learningService.send(
          { cmd: LearningCommands.GetLesson },
          { trackId, lessonId, viewer }
        )
      )
    );
  }

  /**
   * Turns the service's "unknown lesson" into a 404.
   *
   * It was answering 500 for a lesson that does not exist, which was already
   * wrong and became misleading once refusing to show a draft produces the
   * same answer on purpose. A reader who is not entitled to a course and a
   * reader who mistyped an id get the same 404, which is the point.
   */
  private async asNotFoundWhenUnknown<T>(work: () => Promise<T>): Promise<T> {
    try {
      // A thunk, not a promise, so a client that throws before it ever
      // returns an observable is caught here too.
      return await work();
    } catch (error) {
      const payload = (error as { error?: unknown })?.error ?? error;
      if (isLessonNotFound(payload)) throw new NotFoundException(payload);
      throw error;
    }
  }

  /**
   * Who is asking, for the two routes that answer differently depending on it.
   *
   * An anonymous caller resolves to an empty viewer, which sees only published
   * courses.
   */
  private async resolveViewer(req: {
    user?: { userId?: string; profileId?: string };
  }): Promise<{ profileId?: string; seesEveryDraft?: boolean }> {
    const userId = req.user?.userId;
    if (!userId) return {};
    const profileId = await this.learningProfiles.resolveProfileId(userId);
    return {
      profileId,
      seesEveryDraft: await this.offeringAuthorization.seesEveryDraft(
        profileId,
        req.user?.profileId
      ),
    };
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

  // The only route that grants learning_course_designer. Idempotent: opting
  // in twice hits the same role assignment and the permissions service
  // treats a repeat assignment as a no-op rather than an error.
  @UseGuards(AuthGuard)
  @Post('me/author/opt-in')
  async optInAsAuthor(@Req() req: { user: { userId: string } }) {
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    await this.learningProfiles.optInAsAuthor(profileId);
    return { isCourseDesigner: true };
  }

  @UseGuards(AuthGuard)
  @Get('me/author')
  async getAuthorStatus(@Req() req: { user: { userId: string } }) {
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    const isCourseDesigner = await this.learningProfiles.isCourseDesigner(
      profileId
    );
    return { isCourseDesigner };
  }

  @UseGuards(AuthGuard)
  @Post('offerings')
  async createOffering(
    @Body() body: DraftOfferingInput,
    @Req() req: { user: { userId: string; profileId?: string } }
  ) {
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    const allowed = await this.offeringAuthorization.authorize(
      profileId,
      req.user.profileId,
      'create'
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Only a profile that has opted in as a course designer may create an offering.'
      );
    }
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.CreateOffering },
        { profileId, input: body }
      )
    );
  }

  @UseGuards(AuthGuard)
  @Put('offerings/:offeringId')
  async updateOffering(
    @Param('offeringId') offeringId: string,
    // Modules and activities are the course itself. They are validated
    // against OfferingSchema in the service before anything is stored, so an
    // author cannot save a lesson with no words in it.
    @Body()
    body: {
      displayName?: string;
      description?: string;
      modules?: unknown[];
      activities?: unknown[];
    },
    @Req() req: { user: { userId: string; profileId?: string } }
  ) {
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    const allowed = await this.offeringAuthorization.authorize(
      profileId,
      req.user.profileId,
      'update',
      offeringId
    );
    if (!allowed) {
      throw new ForbiddenException(
        'You may only update an offering you own or co-edit.'
      );
    }
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.UpdateOffering },
        { offeringId, patch: body }
      )
    );
  }

  /**
   * Publishing, and taking a course back down.
   *
   * A separate action from updating, so a co-editor can revise a course
   * without deciding it is ready for learners. Only the owner, learning_admin
   * and platform owners may.
   */
  @UseGuards(AuthGuard)
  @Put('offerings/:offeringId/status')
  async setOfferingStatus(
    @Param('offeringId') offeringId: string,
    @Body() body: { status: unknown },
    @Req() req: { user: { userId: string; profileId?: string } }
  ) {
    const status = PublicationStatusSchema.safeParse(body?.status);
    if (!status.success) {
      throw new BadRequestException('status must be draft or published');
    }
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    const allowed = await this.offeringAuthorization.authorize(
      profileId,
      req.user.profileId,
      'publish',
      offeringId
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Only the owning profile, learning_admin, or a platform owner may publish an offering.'
      );
    }
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.SetOfferingStatus },
        { offeringId, status: status.data }
      )
    );
  }

  @UseGuards(AuthGuard)
  @Delete('offerings/:offeringId')
  async deleteOffering(
    @Param('offeringId') offeringId: string,
    @Req() req: { user: { userId: string; profileId?: string } }
  ) {
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    const allowed = await this.offeringAuthorization.authorize(
      profileId,
      req.user.profileId,
      'delete',
      offeringId
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Only the owning profile, learning_admin, or a platform owner may delete an offering.'
      );
    }
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.DeleteOffering },
        { offeringId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @Put('offerings/:offeringId/co-editors')
  async setCoEditors(
    @Param('offeringId') offeringId: string,
    @Body() body: { coEditorProfileIds: string[] },
    @Req() req: { user: { userId: string; profileId?: string } }
  ) {
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    const allowed = await this.offeringAuthorization.authorize(
      profileId,
      req.user.profileId,
      'manageCoEditors',
      offeringId
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Only the owning profile, learning_admin, or a platform owner may change who co-edits an offering.'
      );
    }
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.SetCoEditors },
        { offeringId, coEditorProfileIds: body.coEditorProfileIds }
      )
    );
  }
}
