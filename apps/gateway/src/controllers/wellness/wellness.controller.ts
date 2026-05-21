import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { ServiceTokens, WellnessCommands, WellnessAiCommands } from '@optimistic-tanuki/constants';
import { AppScope } from '../../decorators/appscope.decorator';
import { User } from '../../decorators/user.decorator';

@ApiTags('wellness')
@Controller('wellness')
export class WellnessController {
  private readonly logger = new Logger(WellnessController.name);

  constructor(
    @Inject(ServiceTokens.WELLNESS_SERVICE)
    private readonly wellnessClient: ClientProxy,
    @Inject(ServiceTokens.AI_ORCHESTRATION_SERVICE)
    private readonly aiOrchestrationClient: ClientProxy
  ) {
    this.wellnessClient.connect().catch((e) => console.error(e));
    this.aiOrchestrationClient.connect().catch((e) => console.error(e));
  }

  @Post('ai/prompt')
  @ApiOperation({ summary: 'Generate an AI wellness prompt' })
  @ApiResponse({ status: 200, description: 'AI prompt generated successfully' })
  async generateAiPrompt(
    @Body() data: {
      userInput: string;
      contextType: string;
      additionalContext?: string;
    }
  ) {
    try {
      this.logger.log(`Generating AI prompt for context: ${data.contextType}`);
      return await firstValueFrom(
        this.aiOrchestrationClient.send(
          { cmd: WellnessAiCommands.GENERATE_PROMPT },
          data
        )
      );
    } catch (error) {
      this.logger.error('Error generating AI prompt:', error);
      throw new HttpException(
        'Failed to generate AI prompt',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('ai/context')
  @ApiOperation({ summary: 'Get wellness context description' })
  @ApiResponse({ status: 200, description: 'Context description returned' })
  async getWellnessContext(
    @Body() data: { contextType: string }
  ) {
    try {
      return await firstValueFrom(
        this.aiOrchestrationClient.send(
          { cmd: WellnessAiCommands.GET_CONTEXT },
          data
        )
      );
    } catch (error) {
      this.logger.error('Error getting wellness context:', error);
      throw new HttpException(
        'Failed to get wellness context',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('ai/affirmation')
  @ApiOperation({ summary: 'Get AI affirmation suggestion' })
  @ApiResponse({ status: 200, description: 'Affirmation suggestion returned' })
  async getAffirmationSuggestion(
    @Body() data: { userGoals?: string[] }
  ) {
    try {
      return await firstValueFrom(
        this.aiOrchestrationClient.send(
          { cmd: WellnessAiCommands.GET_AFFIRMATION },
          data
        )
      );
    } catch (error) {
      this.logger.error('Error getting affirmation:', error);
      throw new HttpException(
        'Failed to get affirmation suggestion',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('ai/mindful-activity')
  @ApiOperation({ summary: 'Get AI mindful activity suggestion' })
  @ApiResponse({ status: 200, description: 'Activity suggestion returned' })
  async getMindfulActivitySuggestion(
    @Body() data: { previousActivities?: string[] }
  ) {
    try {
      return await firstValueFrom(
        this.aiOrchestrationClient.send(
          { cmd: WellnessAiCommands.GET_MINDFUL_ACTIVITY },
          data
        )
      );
    } catch (error) {
      this.logger.error('Error getting mindful activity:', error);
      throw new HttpException(
        'Failed to get mindful activity suggestion',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('ai/gratitude-analysis')
  @ApiOperation({ summary: 'Get AI gratitude analysis' })
  @ApiResponse({ status: 200, description: 'Gratitude analysis returned' })
  async analyzeGratitude(
    @Body() data: { gratitudeEntry: string }
  ) {
    try {
      return await firstValueFrom(
        this.aiOrchestrationClient.send(
          { cmd: WellnessAiCommands.ANALYZE_GRATITUDE },
          data
        )
      );
    } catch (error) {
      this.logger.error('Error analyzing gratitude:', error);
      throw new HttpException(
        'Failed to analyze gratitude',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('ai/judgment-reflection')
  @ApiOperation({ summary: 'Get AI judgment reflection' })
  @ApiResponse({ status: 200, description: 'Judgment reflection returned' })
  async reflectJudgment(
    @Body() data: { judgment: string }
  ) {
    try {
      return await firstValueFrom(
        this.aiOrchestrationClient.send(
          { cmd: WellnessAiCommands.REFLECT_JUDGMENT },
          data
        )
      );
    } catch (error) {
      this.logger.error('Error reflecting on judgment:', error);
      throw new HttpException(
        'Failed to generate judgment reflection',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('daily-four')
  @ApiOperation({ summary: 'Create a Daily Four entry' })
  @ApiResponse({ status: 201, description: 'Entry created successfully' })
  async createDailyFour(
    @Body() data: {
      affirmation: string;
      mindfulActivity: string;
      gratitude: string;
      plannedPleasurable: string;
      public?: boolean;
    },
    @User('userId') userId: string,
    @AppScope() appScope: string
  ) {
    try {
      this.logger.log(`Creating DailyFour for user ${userId} in scope ${appScope}`);
      return await firstValueFrom(
        this.wellnessClient.send(
          { cmd: WellnessCommands.CREATE_DAILY_FOUR },
          { userId, dto: data }
        )
      );
    } catch (error) {
      this.logger.error('Error creating DailyFour:', error);
      throw new HttpException(
        'Failed to create DailyFour entry',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('daily-four')
  @ApiOperation({ summary: 'Get Daily Four entries' })
  async getDailyFour(
    @User('userId') userId: string,
    @Query('publicOnly') publicOnly?: string
  ) {
    try {
      if (publicOnly === 'true') {
        return await firstValueFrom(
          this.wellnessClient.send(
            { cmd: WellnessCommands.GET_DAILY_FOUR_ALL },
            { publicOnly: true }
          )
        );
      }
      return await firstValueFrom(
        this.wellnessClient.send(
          { cmd: WellnessCommands.GET_DAILY_FOUR_BY_USER },
          userId
        )
      );
    } catch (error) {
      this.logger.error('Error fetching DailyFour:', error);
      throw new HttpException(
        'Failed to fetch DailyFour entries',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch('daily-four/:id')
  @ApiOperation({ summary: 'Update a Daily Four entry' })
  async updateDailyFour(
    @Param('id') id: string,
    @Body() data: {
      affirmation?: string;
      mindfulActivity?: string;
      gratitude?: string;
      plannedPleasurable?: string;
      public?: boolean;
    }
  ) {
    try {
      return await firstValueFrom(
        this.wellnessClient.send(
          { cmd: WellnessCommands.UPDATE_DAILY_FOUR },
          { id, dto: data }
        )
      );
    } catch (error) {
      this.logger.error('Error updating DailyFour:', error);
      throw new HttpException(
        'Failed to update DailyFour entry',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('daily-four/:id')
  @ApiOperation({ summary: 'Delete a Daily Four entry' })
  async deleteDailyFour(@Param('id') id: string) {
    try {
      return await firstValueFrom(
        this.wellnessClient.send(
          { cmd: WellnessCommands.DELETE_DAILY_FOUR },
          { id }
        )
      );
    } catch (error) {
      this.logger.error('Error deleting DailyFour:', error);
      throw new HttpException(
        'Failed to delete DailyFour entry',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('daily-six')
  @ApiOperation({ summary: 'Create a Daily Six entry' })
  @ApiResponse({ status: 201, description: 'Entry created successfully' })
  async createDailySix(
    @Body() data: {
      affirmation: string;
      judgement: string;
      nonJudgement: string;
      mindfulActivity: string;
      gratitude: string;
      public?: boolean;
    },
    @User('userId') userId: string,
    @AppScope() appScope: string
  ) {
    try {
      this.logger.log(`Creating DailySix for user ${userId} in scope ${appScope}`);
      return await firstValueFrom(
        this.wellnessClient.send(
          { cmd: WellnessCommands.CREATE_DAILY_SIX },
          { userId, dto: data }
        )
      );
    } catch (error) {
      this.logger.error('Error creating DailySix:', error);
      throw new HttpException(
        'Failed to create DailySix entry',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('daily-six')
  @ApiOperation({ summary: 'Get Daily Six entries' })
  async getDailySix(
    @User('userId') userId: string,
    @Query('publicOnly') publicOnly?: string
  ) {
    try {
      if (publicOnly === 'true') {
        return await firstValueFrom(
          this.wellnessClient.send(
            { cmd: WellnessCommands.GET_DAILY_SIX_ALL },
            { publicOnly: true }
          )
        );
      }
      return await firstValueFrom(
        this.wellnessClient.send(
          { cmd: WellnessCommands.GET_DAILY_SIX_BY_USER },
          userId
        )
      );
    } catch (error) {
      this.logger.error('Error fetching DailySix:', error);
      throw new HttpException(
        'Failed to fetch DailySix entries',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch('daily-six/:id')
  @ApiOperation({ summary: 'Update a Daily Six entry' })
  async updateDailySix(
    @Param('id') id: string,
    @Body() data: {
      affirmation?: string;
      judgement?: string;
      nonJudgement?: string;
      mindfulActivity?: string;
      gratitude?: string;
      public?: boolean;
    }
  ) {
    try {
      return await firstValueFrom(
        this.wellnessClient.send(
          { cmd: WellnessCommands.UPDATE_DAILY_SIX },
          { id, dto: data }
        )
      );
    } catch (error) {
      this.logger.error('Error updating DailySix:', error);
      throw new HttpException(
        'Failed to update DailySix entry',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('daily-six/:id')
  @ApiOperation({ summary: 'Delete a Daily Six entry' })
  async deleteDailySix(@Param('id') id: string) {
    try {
      return await firstValueFrom(
        this.wellnessClient.send(
          { cmd: WellnessCommands.DELETE_DAILY_SIX },
          { id }
        )
      );
    } catch (error) {
      this.logger.error('Error deleting DailySix:', error);
      throw new HttpException(
        'Failed to delete DailySix entry',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
