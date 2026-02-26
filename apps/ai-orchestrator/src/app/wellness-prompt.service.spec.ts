import { Test, TestingModule } from '@nestjs/testing';
import { WellnessPromptService, WellnessContextType } from './wellness-prompt.service';

describe('WellnessPromptService', () => {
  let service: WellnessPromptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WellnessPromptService],
    }).compile();

    service = module.get<WellnessPromptService>(WellnessPromptService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePrompt', () => {
    it('should generate a prompt with the given user input and context', () => {
      const userInput = 'This is my user input.';
      const contextType: WellnessContextType = 'affirmation';

      const prompt = service.generatePrompt({
        userInput,
        contextType,
      });

      expect(prompt).toContain('You are an AI assistant designed to help with');
      expect(prompt).toContain('affirmations are statements');
      expect(prompt).toContain(`User Input: "${userInput}"`);
      expect(prompt).toContain('Provide an up or down value');
    });

    it('should include additional context when provided', () => {
      const userInput = 'Test input';
      const additionalContext = 'Focus on morning routine';

      const prompt = service.generatePrompt({
        userInput,
        contextType: 'mindfulActivity',
        additionalContext,
      });

      expect(prompt).toContain('Additional context: Focus on morning routine');
    });
  });

  describe('getPromptContext', () => {
    it('should return the correct context description for affirmation', () => {
      const context = service.getPromptContext('affirmation');
      expect(context).toContain('affirmations are statements to boost confidence and positivity');
    });

    it('should return the correct context description for plannedPleasurable', () => {
      const context = service.getPromptContext('plannedPleasurable');
      expect(context).toContain('activities that bring joy and relaxation');
    });

    it('should return the correct context description for judgement', () => {
      const context = service.getPromptContext('judgement');
      expect(context).toContain('ways to handle judgement and criticism');
    });

    it('should return the correct context description for nonJudgement', () => {
      const context = service.getPromptContext('nonJudgement');
      expect(context).toContain('practices for non-judgmental awareness');
    });

    it('should return the correct context description for mindfulActivity', () => {
      const context = service.getPromptContext('mindfulActivity');
      expect(context).toContain('mindful activities to enhance presence');
    });

    it('should return the correct context description for gratitude', () => {
      const context = service.getPromptContext('gratitude');
      expect(context).toContain('expressions of gratitude and appreciation');
    });
  });

  describe('generateAffirmationSuggestion', () => {
    it('should generate an affirmation suggestion', () => {
      const suggestion = service.generateAffirmationSuggestion();
      expect(suggestion).toContain('personalized affirmation');
      expect(suggestion).toContain('positive and empowering');
    });

    it('should include user goals when provided', () => {
      const userGoals = ['improve focus', 'reduce stress'];
      const suggestion = service.generateAffirmationSuggestion(userGoals);
      expect(suggestion).toContain('improve focus');
      expect(suggestion).toContain('reduce stress');
    });
  });

  describe('generateMindfulActivitySuggestion', () => {
    it('should generate a mindful activity suggestion', () => {
      const suggestion = service.generateMindfulActivitySuggestion();
      expect(suggestion).toContain('mindfulness coach');
      expect(suggestion).toContain('mindful activity');
    });

    it('should consider previous activities when provided', () => {
      const previousActivities = ['breathing exercise', 'meditation'];
      const suggestion = service.generateMindfulActivitySuggestion(previousActivities);
      expect(suggestion).toContain('breathing exercise');
      expect(suggestion).toContain('meditation');
    });
  });

  describe('generateGratitudeAnalysis', () => {
    it('should generate a gratitude analysis', () => {
      const gratitudeEntry = 'I am grateful for my family';
      const analysis = service.generateGratitudeAnalysis(gratitudeEntry);
      expect(analysis).toContain('gratitude coach');
      expect(analysis).toContain('grateful for my family');
    });
  });

  describe('generateJudgmentReflection', () => {
    it('should generate a judgment reflection', () => {
      const judgment = 'I am too lazy to finish my work';
      const reflection = service.generateJudgmentReflection(judgment);
      expect(reflection).toContain('DBT coach');
      expect(reflection).toContain('too lazy');
    });
  });
});
