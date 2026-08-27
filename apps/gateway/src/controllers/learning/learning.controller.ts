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
import {
  LearningCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  DraftOfferingInput,
  isLessonNotFound,
  isOfferingNotFound,
  isNotEnrolled,
  PublicationStatusSchema,
} from '@optimistic-tanuki/learning-domain';
import { Throttle } from '@nestjs/throttler';
import { ModelBound } from '../../decorators/request-timeout.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { LearningProfileResolver } from './learning-profile.resolver';
import { OfferingAuthorizationService } from './offering-authorization.service';
import { IdentityThrottlerGuard } from './identity-throttler.guard';

const limitFromEnv = (envKey: string, fallback: number): number => {
  const raw = process.env[envKey];
  const parsed = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * What one identity may spend per minute on the expensive routes.
 *
 * Overrides have to name a throttler configured in the gateway's
 * ThrottlerModule, which is `short` / `medium` / `long`. `long` is the sixty
 * second window, so that is the one worth constraining; the others stay at
 * the gateway defaults.
 *
 * Running code is capped higher than grading because a learner iterating on a
 * compiler error genuinely runs it many times in a row, and that is the work,
 * not abuse. Grading is capped lower because each call occupies a language
 * model, and nobody writes thirty considered paragraphs in a minute.
 */
const THROTTLE_TTL = limitFromEnv('THROTTLE_LEARNING_TTL', 60000);
const RUN_THROTTLE = {
  long: {
    limit: limitFromEnv('THROTTLE_LEARNING_RUN_LIMIT', 60),
    ttl: THROTTLE_TTL,
  },
};
const GRADING_THROTTLE = {
  long: {
    limit: limitFromEnv('THROTTLE_LEARNING_GRADING_LIMIT', 20),
    ttl: THROTTLE_TTL,
  },
};

@Controller('learning')
export class LearningController {
  constructor(
    @Inject(ServiceTokens.LEARNING_SERVICE)
    private readonly learningService: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
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

  // The subjects in this caller's catalog, named by the server so the rule
  // for naming them is not duplicated in the browser.
  @Public()
  @UseGuards(AuthGuard)
  @Get('subjects')
  async listSubjects(
    @Req() req: { user?: { userId?: string; profileId?: string } }
  ) {
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.ListSubjects },
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

  /*
    There were two routes here, POST attempts and POST evaluations, and they
    were the way to cheat.

    Both were guarded by nothing but a session. Submitting an attempt checked
    no enrolment and did not check the activity existed; recording an
    evaluation stored whatever score the caller sent and marked the attempt
    graded. Any signed-in learner could forge an attempt against any activity
    and award themselves full marks, which is precisely what the comment on
    Evaluation.recordedByUserId says must never be possible.

    Nothing called them. Marks are only ever written by the server now, from
    answerActivity and submitExercise, which check enrolment and grade the
    work themselves. A human-override route can come back when there is a
    screen for it and a role check on it.
  */

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
      if (isLessonNotFound(payload) || isOfferingNotFound(payload)) {
        throw new NotFoundException(payload);
      }
      throw error;
    }
  }

  /**
   * A course page: what it is, who wrote it, and whether you are in it.
   *
   * Open to anonymous readers, and gated the same way as the catalog and the
   * lesson route. The author's name and the caller's enrolment are added here
   * rather than in the learning service, which knows neither profiles nor
   * sessions.
   */
  @Public()
  @UseGuards(AuthGuard)
  @Get('offerings/:offeringId')
  async getOffering(
    @Param('offeringId') offeringId: string,
    @Req() req: { user?: { userId?: string; profileId?: string } }
  ) {
    const viewer = await this.resolveViewer(req);
    const detail = (await this.asNotFoundWhenUnknown(() =>
      firstValueFrom(
        this.learningService.send(
          { cmd: LearningCommands.GetOffering },
          { offeringId, viewer }
        )
      )
    )) as { ownerProfileId?: string };

    const [author, isEnrolled] = await Promise.all([
      this.resolveAuthor(detail.ownerProfileId),
      this.isEnrolledIn(viewer.profileId, offeringId),
    ]);
    return {
      ...detail,
      author,
      isEnrolled,
      // Publishing is the owner's call, so the editor needs to know whether
      // this viewer is the owner. It used to assume yes and show everyone a
      // button that always answered 403.
      isOwner: Boolean(
        viewer.profileId && detail.ownerProfileId === viewer.profileId
      ),
    };
  }

  /**
   * The author's display name, or nothing.
   *
   * A course whose author cannot be looked up still renders; it just does not
   * say who wrote it. Failing the whole page because the profile service is
   * unreachable would be a poor trade for one line of text.
   */
  private async resolveAuthor(
    ownerProfileId: string | undefined
  ): Promise<{ profileId: string; displayName: string } | null> {
    if (!ownerProfileId) return null;
    try {
      const profile = (await firstValueFrom(
        this.profileClient.send(
          { cmd: ProfileCommands.Get },
          { id: ownerProfileId, query: {} }
        )
      )) as { id?: string; profileName?: string } | null;
      // The field is profileName, not name. Reading `name` returned undefined
      // every time, so every course said its author was not recorded, and
      // nothing failed loudly enough to notice.
      const displayName = profile?.profileName?.trim();
      if (!displayName) return null;
      return { profileId: ownerProfileId, displayName };
    } catch {
      return null;
    }
  }

  private async isEnrolledIn(
    profileId: string | undefined,
    offeringId: string
  ): Promise<boolean> {
    if (!profileId) return false;
    const enrolments = (await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.ListMyEnrolments },
        { profileId }
      )
    )) as Array<{ offeringId: string; status: string }>;
    return (enrolments ?? []).some(
      (enrolment) =>
        enrolment.offeringId === offeringId && enrolment.status === 'active'
    );
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

  /**
   * Records that a learner has read a lesson, or has not.
   *
   * Only those two facts are taken from the caller. Points and solved
   * exercises used to come straight from the request body and were written
   * verbatim, so anyone could award themselves any score by editing one
   * request. What a lesson is worth is decided by the server, from work it
   * watched happen.
   */
  @UseGuards(AuthGuard)
  @Put('me/progress')
  async saveMyProgress(
    @Req() req: { user: { userId: string } },
    @Body() body: { lessonId?: unknown; completed?: unknown }
  ) {
    const lessonId = typeof body?.lessonId === 'string' ? body.lessonId : '';
    if (!lessonId) throw new BadRequestException('lessonId is required');
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    return await this.asConflictWhenNotEnrolled(
      firstValueFrom(
        this.learningService.send(
          { cmd: LearningCommands.SaveLessonProgress },
          {
            userId: req.user.userId,
            profileId,
            lessonId,
            completed: body?.completed !== false,
          }
        )
      )
    );
  }

  // Running code is compute and must be attributable to a session, even
  // though a plain run does not record anything against the learner.
  @UseGuards(AuthGuard, IdentityThrottlerGuard)
  @Throttle(RUN_THROTTLE)
  @Post('runs')
  async runCode(@Body() body: { activityId: string; code: string }) {
    return await firstValueFrom(
      this.learningService.send({ cmd: LearningCommands.RunCode }, body)
    );
  }

  // Submitting runs the code too, so it costs the same as a plain run.
  @UseGuards(AuthGuard, IdentityThrottlerGuard)
  @Throttle(RUN_THROTTLE)
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

  /**
   * Answers an activity an author wrote.
   *
   * The submission is whatever the activity takes: chosen option ids for a
   * multiple choice, prose for a written answer. It is graded on the service
   * side and never trusted on the way back.
   */
  @UseGuards(AuthGuard)
  // Marking a written answer occupies a language model, so this is the
  // tightest of the three throttles.
  //
  // It is also model-bound, and the gateway's 30 second default is not enough:
  // a written answer graded against a rubric answered a 408 here while the
  // marking itself completed fine a moment later. A learner cannot tell that
  // apart from the feature being broken, and this course is mostly written
  // answers.
  @ModelBound()
  @UseGuards(IdentityThrottlerGuard)
  @Throttle(GRADING_THROTTLE)
  @Post('activities/:activityId/answer')
  async answerActivity(
    @Param('activityId') activityId: string,
    @Body() body: { submission: unknown },
    @Req() req: { user: { userId: string } }
  ) {
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    return await this.asConflictWhenNotEnrolled(
      firstValueFrom(
        this.learningService.send(
          { cmd: LearningCommands.AnswerActivity },
          {
            profileId,
            userId: req.user.userId,
            activityId,
            submission: body?.submission,
          }
        )
      )
    );
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

  /**
   * Who the caller is, in this app's terms.
   *
   * The client cannot read the session cookie, so this is the only way for it
   * to know whether anyone is signed in and what to call them. Anonymous
   * callers get null rather than a 401, because the header renders for
   * everyone.
   */
  @Public()
  @UseGuards(AuthGuard)
  @Get('me')
  async getMe(@Req() req: { user?: { userId?: string } }) {
    const userId = req.user?.userId;
    if (!userId) return null;
    const profileId = await this.learningProfiles.resolveProfileId(userId);
    const author = await this.learningProfiles.isCourseDesigner(profileId);
    const profile = await this.resolveAuthor(profileId);
    return {
      profileId,
      name: profile?.displayName ?? 'Learner',
      isCourseDesigner: author,
    };
  }

  // An author's own courses, drafts included. Nothing else lists a draft to
  // the person writing it.
  @UseGuards(AuthGuard)
  @Get('me/courses')
  async getMyCourses(@Req() req: { user: { userId: string } }) {
    const profileId = await this.learningProfiles.resolveProfileId(
      req.user.userId
    );
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.ListMyOfferings },
        { profileId }
      )
    );
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
      audience?: string;
      outcome?: string;
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
    // Built field by field on purpose. Forwarding the body wholesale let a
    // co-editor publish a course by adding "status" to an edit, walking
    // straight past the publish check above. The global ValidationPipe does
    // not catch this: every body in this controller is an inline type, which
    // reflects as Object, and Nest skips validation for those.
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.UpdateOffering },
        {
          offeringId,
          patch: {
            ...(body?.displayName !== undefined
              ? { displayName: body.displayName }
              : {}),
            ...(body?.description !== undefined
              ? { description: body.description }
              : {}),
            // The case the course makes for itself. Listed here explicitly,
            // like every other field, so adding one never becomes a way to
            // smuggle in a field that is not meant to be author-editable.
            ...(body?.audience !== undefined
              ? { audience: body.audience }
              : {}),
            ...(body?.outcome !== undefined ? { outcome: body.outcome } : {}),
            ...(body?.modules !== undefined ? { modules: body.modules } : {}),
            ...(body?.activities !== undefined
              ? { activities: body.activities }
              : {}),
          },
        }
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
