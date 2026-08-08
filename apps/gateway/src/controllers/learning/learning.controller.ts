import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { LearningCommands, ServiceTokens } from '@optimistic-tanuki/constants';

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

  @Post('attempts')
  async submitAttempt(@Body() body: unknown) {
    return await firstValueFrom(
      this.learningService.send({ cmd: LearningCommands.SubmitAttempt }, body)
    );
  }

  @Post('evaluations')
  async recordEvaluation(@Body() body: unknown) {
    return await firstValueFrom(
      this.learningService.send({ cmd: LearningCommands.RecordEvaluation }, body)
    );
  }
}
