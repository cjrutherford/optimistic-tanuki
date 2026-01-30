import {
  generateCoreSystemPrompt,
  generateToolingGuidance,
  buildConversationPreamble,
  extractUserFacingContent,
  shouldEmitToUser,
} from './prompt-engineering';
import { ProfileDto } from '@optimistic-tanuki/models';

describe('Prompt Engineering Utilities', () => {
  const mockProfile: ProfileDto = {
    id: 'test-user-123',
    userId: 'test-user-123',
    profileName: 'Test User',
    profilePic: '',
    coverPic: '',
    bio: '',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('generateCoreSystemPrompt', () => {
    it('should include user context and protocols', () => {
      const result = generateCoreSystemPrompt(mockProfile);
      expect(result).toContain(mockProfile.id);
      expect(result).toContain(mockProfile.profileName);
      expect(result).toContain('USER CONTEXT');
      expect(result).toContain('OPERATIONAL PROTOCOLS');
      expect(result).toContain('STRICT ID VERIFICATION');
    });
  });

  describe('generateToolingGuidance', () => {
    it('should include tool descriptions and error handling', () => {
      const result = generateToolingGuidance();
      expect(result).toContain('TOOL GUIDANCE');
      expect(result).toContain('create_project');
      expect(result).toContain('ERROR HANDLING');
    });
  });

  describe('buildConversationPreamble', () => {
    it('should combine all sections', () => {
      const systemPrompt = 'You are a helpful assistant';
      const summary = 'Previous summary';
      const maxIter = 5;
      
      const result = buildConversationPreamble(
        systemPrompt,
        mockProfile,
        summary,
        maxIter
      );

      expect(result).toContain(systemPrompt);
      expect(result).toContain('USER CONTEXT');
      expect(result).toContain('TOOL GUIDANCE');
      expect(result).toContain('CONVERSATION SUMMARY');
      expect(result).toContain(summary);
      expect(result).toContain('OPERATIONAL LIMITS');
      expect(result).toContain(maxIter.toString());
    });
  });

  describe('extractUserFacingContent', () => {
    it('should return content if tool calls are absent', () => {
      expect(extractUserFacingContent('Hello')).toBe('Hello');
    });

    it('should return null if content is empty and tool calls present', () => {
      expect(extractUserFacingContent('', [{}])).toBeNull();
    });

    it('should return content if content is present with tool calls', () => {
      expect(extractUserFacingContent('Thinking...', [{}])).toBe('Thinking...');
    });
  });

  describe('shouldEmitToUser', () => {
    it('should return true for normal text', () => {
      expect(shouldEmitToUser('Hello')).toBe(true);
    });

    it('should return false for tool calls with empty content', () => {
      expect(shouldEmitToUser('', [{}])).toBe(false);
    });
  });
});