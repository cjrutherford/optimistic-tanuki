import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { WellnessPromptService, WellnessContextType } from './wellness-prompt.service';
import { WellnessAiCommands } from '@optimistic-tanuki/constants';

interface GeneratePromptDto {
  userInput: string;
  contextType: WellnessContextType;
  additionalContext?: string;
}

interface GetContextDto {
  contextType: WellnessContextType;
}

interface GetAffirmationDto {
  userGoals?: string[];
}

interface GetMindfulActivityDto {
  previousActivities?: string[];
}

interface AnalyzeGratitudeDto {
  gratitudeEntry: string;
}

interface ReflectJudgmentDto {
  judgment: string;
}

@Controller()
export class WellnessController {
  private readonly logger = new Logger(WellnessController.name);

  constructor(private readonly wellnessPromptService: WellnessPromptService) {}

  @MessagePattern({ cmd: WellnessAiCommands.GENERATE_PROMPT })
  generatePrompt(data: GeneratePromptDto) {
    this.logger.log(`Generating wellness prompt for context: ${data.contextType}`);
    
    const prompt = this.wellnessPromptService.generatePrompt({
      userInput: data.userInput,
      contextType: data.contextType,
      additionalContext: data.additionalContext,
    });

    return { prompt };
  }

  @MessagePattern({ cmd: WellnessAiCommands.GET_CONTEXT })
  getContext(data: GetContextDto) {
    this.logger.log(`Getting context for: ${data.contextType}`);
    
    const context = this.wellnessPromptService.getPromptContext(data.contextType);
    return { context };
  }

  @MessagePattern({ cmd: WellnessAiCommands.GET_AFFIRMATION })
  getAffirmation(data: GetAffirmationDto) {
    this.logger.log('Generating affirmation suggestion');
    
    const suggestion = this.wellnessPromptService.generateAffirmationSuggestion(
      data.userGoals
    );
    return { suggestion };
  }

  @MessagePattern({ cmd: WellnessAiCommands.GET_MINDFUL_ACTIVITY })
  getMindfulActivity(data: GetMindfulActivityDto) {
    this.logger.log('Generating mindful activity suggestion');
    
    const suggestion = this.wellnessPromptService.generateMindfulActivitySuggestion(
      data.previousActivities
    );
    return { suggestion };
  }

  @MessagePattern({ cmd: WellnessAiCommands.ANALYZE_GRATITUDE })
  analyzeGratitude(data: AnalyzeGratitudeDto) {
    this.logger.log('Analyzing gratitude entry');
    
    const analysis = this.wellnessPromptService.generateGratitudeAnalysis(
      data.gratitudeEntry
    );
    return { analysis };
  }

  @MessagePattern({ cmd: WellnessAiCommands.REFLECT_JUDGMENT })
  reflectJudgment(data: ReflectJudgmentDto) {
    this.logger.log('Generating judgment reflection');
    
    const reflection = this.wellnessPromptService.generateJudgmentReflection(
      data.judgment
    );
    return { reflection };
  }
}
