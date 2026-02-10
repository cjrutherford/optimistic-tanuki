/**
 * Wellness Prompt Service
 *
 * Provides DBT/CBT-based prompts for D6 wellness tracking.
 * Handles Daily Four and Daily Six wellness exercises.
 */

import { Injectable, Logger } from '@nestjs/common';

export type WellnessContextType =
  | 'affirmation'
  | 'plannedPleasurable'
  | 'judgement'
  | 'nonJudgement'
  | 'mindfulActivity'
  | 'gratitude';

export interface WellnessPromptRequest {
  userInput: string;
  contextType: WellnessContextType;
  additionalContext?: string;
}

export interface WellnessPromptResponse {
  prompt: string;
  analysis: string;
  response: 'up' | 'down';
}

@Injectable()
export class WellnessPromptService {
  private readonly logger = new Logger(WellnessPromptService.name);

  /**
   * Generate a wellness prompt with DBT/CBT context
   */
  generatePrompt(request: WellnessPromptRequest): string {
    const { userInput, contextType, additionalContext } = request;
    const contextDescription = this.getPromptContext(contextType);

    const promptStructure = `
You are an AI assistant designed to help with ${contextDescription}.
You are versed in the skills of Dialectical Behavior Therapy (DBT) and Cognitive Behavioral Therapy (CBT).
Do not ask further prompts as part of the response. Simply provide a short analysis of the user input.
The purpose of the exercise is to help the user reflect on their thoughts and feelings in a safe, constructive, and mindful manner.

${additionalContext ? `Additional context: ${additionalContext}` : ''}

User Input: "${userInput}"

Please keep your response to a single paragraph.
Provide an up or down value to determine if the user input is a good response to the prompt. (the up down value should be "response: "up" or "response: "down")
The response already requested should be a down value if the user input is not a good response like not following the prompt, or not being constructive.
Only provide the up/down response value once and only at the end of your response.`;

    return promptStructure.trim();
  }

  /**
   * Get the context description for a wellness context type
   */
  getPromptContext(contextType: WellnessContextType): string {
    const initialContext =
      'a daily prompt series to help improve their mental well-being and mindfulness. the current context is ' +
      contextType +
      '. Remember that: ';

    const contextDescriptions: Record<WellnessContextType, string> = {
      affirmation:
        'affirmations are statements to boost confidence and positivity. Please ensure the user input is a useful affirmation and respond to the affirmation constructively.',
      plannedPleasurable:
        'activities that bring joy and relaxation. Please ensure the user input is a planned pleasurable activity and respond to it constructively. if it\'s not, suggest a new activity.',
      judgement:
        'ways to handle judgement and criticism. Please ensure the user input is related to judgement and respond to it constructively. The purpose here is to vent, and understand that if there is a judgement, we will be trying to turn it around in a non-judgement step.',
      nonJudgement:
        'practices for non-judgmental awareness. Please ensure the user input is related to non-judgment and respond to it constructively.',
      mindfulActivity:
        'mindful activities to enhance presence. Please ensure the user input is related to mindfulness and respond to it constructively.',
      gratitude:
        'expressions of gratitude and appreciation. Please ensure the user input is a genuine expression of gratitude and respond to it constructively.',
    };

    return contextDescriptions[contextType]
      ? initialContext + contextDescriptions[contextType]
      : 'general assistance';
  }

  /**
   * Generate an affirmation suggestion
   */
  generateAffirmationSuggestion(userGoals?: string[]): string {
    const goalsContext = userGoals?.length
      ? ` Consider the user's goals: ${userGoals.join(', ')}.`
      : '';

    return `You are a supportive wellness coach. Generate a personalized affirmation that:${goalsContext}
- Is positive and empowering
- Uses present tense
- Is specific and meaningful
- Supports mental well-being

Keep the affirmation short (1-2 sentences).`;
  }

  /**
   * Generate a mindful activity suggestion
   */
  generateMindfulActivitySuggestion(
    previousActivities?: string[]
  ): string {
    const historyContext = previousActivities?.length
      ? `The user has recently done: ${previousActivities.join(', ')}.`
      : '';

    return `You are a mindfulness coach. Suggest a mindful activity that:${historyContext}
- Is accessible and simple
- Can be done in 5-15 minutes
- Promotes present-moment awareness
- Supports mental well-being

Keep the suggestion brief (1-2 sentences).`;
  }

  /**
   * Analyze a gratitude entry
   */
  generateGratitudeAnalysis(gratitudeEntry: string): string {
    return `You are a gratitude coach. Reflect on this gratitude entry:
"${gratitudeEntry}"

Provide:
1. A brief acknowledgment of what the user expressed gratitude for
2. A gentle prompt to deepen their reflection (optional)

Keep your response supportive and brief.`;
  }

  /**
   * Generate judgment-to-non-judgment reflection prompt
   */
  generateJudgmentReflection(judgment: string): string {
    return `You are a DBT coach. The user expressed this judgment:
"${judgment}"

Help them transform this into non-judgmental awareness:
1. Acknowledge the judgment without reinforcing it
2. Offer a neutral observation about the situation
3. Suggest a compassionate perspective

Keep the response brief and supportive.`;
  }
}
