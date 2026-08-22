import {
  Body,
  Controller,
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
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';

@Controller('learning')
export class LearningController {
  constructor(
    @Inject(ServiceTokens.LEARNING_SERVICE)
    private readonly learningService: ClientProxy
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
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.GetDashboard },
        { userId: req.user?.userId }
      )
    );
  }

  @Post('attempts')
  async submitAttempt(@Body() body: unknown) {
    return await firstValueFrom(
      this.learningService.send({ cmd: LearningCommands.SubmitAttempt }, body)
    );
  }

  @Post('evaluations')
  async recordEvaluation(@Body() body: unknown) {
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.RecordEvaluation },
        body
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

  // Authentication integration will replace this development identity with the JWT subject.
  @Get('progress/:userId')
  async getProgress(@Param('userId') userId: string) {
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.GetProgress },
        { userId }
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
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.GetProgress },
        { userId }
      )
    );
  }

  @Put('progress/:userId')
  async saveProgress(
    @Param('userId') userId: string,
    @Body() progress: unknown
  ) {
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.SaveLessonProgress },
        { userId, progress }
      )
    );
  }

  @UseGuards(AuthGuard)
  @Put('me/progress')
  async saveMyProgress(
    @Req() req: { user: { userId: string } },
    @Body() progress: unknown
  ) {
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.SaveLessonProgress },
        { userId: req.user.userId, progress }
      )
    );
  }

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
    return await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.SubmitExercise },
        { userId: req.user.userId, activityId, code: body.code }
      )
    );
  }
}
