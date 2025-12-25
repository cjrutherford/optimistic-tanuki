/**
 * Tests for Prompt Engineering Utilities
 */

import {
  generateToolCallingPrimer,
  generateSystemInvariants,
  generateUserContext,
  generateToolUsageGuidelines,
  generateToolResultHandling,
  generateResponseRules,
  generateOperationalLimits,
  buildConversationPreamble,
  extractUserFacingContent,
  shouldEmitToUser,
} from './prompt-engineering';
import { ProfileDto } from '@optimistic-tanuki/models';

describe('Prompt Engineering Utilities', () => {
  const mockProfile: ProfileDto = {
    id: 'test-user-123',
    profileName: 'Test User',
    email: 'test@example.com',
    bio: 'Test bio',
    avatarUrl: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    appScope: 'test-app',
  };

  describe('generateToolCallingPrimer', () => {
    it('should include profile ID in primer', () => {
      const result = generateToolCallingPrimer(mockProfile.id);
      expect(result).toContain(mockProfile.id);
      expect(result).toContain('TOOL CALLING GUIDELINES');
      expect(result).toContain('CRITICAL PARAMETER RULES');
    });

    it('should include examples', () => {
      const result = generateToolCallingPrimer(mockProfile.id);
      expect(result).toContain('PARAMETER EXAMPLES');
      expect(result).toContain('✓ Correct');
      expect(result).toContain('✗ Wrong');
    });
  });

  describe('generateSystemInvariants', () => {
    it('should include profile ID', () => {
      const result = generateSystemInvariants(mockProfile.id);
      expect(result).toContain(mockProfile.id);
      expect(result).toContain('SYSTEM INVARIANTS');
    });

    it('should mention list_projects requirement', () => {
      const result = generateSystemInvariants(mockProfile.id);
      expect(result).toContain('list_projects');
    });
  });

  describe('generateUserContext', () => {
    it('should include user profile ID and name', () => {
      const result = generateUserContext(mockProfile);
      expect(result).toContain(mockProfile.id);
      expect(result).toContain(mockProfile.profileName);
      expect(result).toContain('USER CONTEXT');
    });
  });

  describe('generateToolUsageGuidelines', () => {
    it('should provide clear guidelines', () => {
      const result = generateToolUsageGuidelines();
      expect(result).toContain('TOOL USAGE GUIDELINES');
      expect(result).toContain('ONE tool at a time');
    });
  });

  describe('generateToolResultHandling', () => {
    it('should include error handling instructions', () => {
      const result = generateToolResultHandling();
      expect(result).toContain('HANDLING TOOL RESULTS');
      expect(result).toContain('error');
      expect(result).toContain('isError');
    });
  });

  describe('generateResponseRules', () => {
    it('should include examples with profile ID', () => {
      const result = generateResponseRules(mockProfile.id);
      expect(result).toContain('RESPONSE RULES');
      expect(result).toContain('EXAMPLES');
      expect(result).toContain(mockProfile.id);
    });

    it('should include TELOS format', () => {
      const result = generateResponseRules(mockProfile.id);
      expect(result).toContain('TELOS');
      expect(result).toContain('goals');
      expect(result).toContain('objectives');
    });
  });

  describe('generateOperationalLimits', () => {
    it('should include max iterations', () => {
      const maxIter = 6;
      const result = generateOperationalLimits(maxIter);
      expect(result).toContain('OPERATIONAL LIMITS');
      expect(result).toContain(maxIter.toString());
    });
  });

  describe('buildConversationPreamble', () => {
    it('should combine all sections', () => {
      const systemPrompt = 'You are a helpful assistant';
      const conversationSummary = 'Previous conversation summary';
      const maxIterations = 6;

      const result = buildConversationPreamble(
        systemPrompt,
        mockProfile,
        conversationSummary,
        maxIterations
      );

      expect(result).toContain(systemPrompt);
      expect(result).toContain('USER CONTEXT');
      expect(result).toContain('SYSTEM INVARIANTS');
      expect(result).toContain('TOOL USAGE GUIDELINES');
      expect(result).toContain('RESPONSE RULES');
      expect(result).toContain('OPERATIONAL LIMITS');
    });

    it('should include project resource if provided', () => {
      const systemPrompt = 'System prompt';
      const conversationSummary = 'Summary';
      const maxIterations = 6;
      const projectResource = { schema: 'test schema' };

      const result = buildConversationPreamble(
        systemPrompt,
        mockProfile,
        conversationSummary,
        maxIterations,
        projectResource
      );

      expect(result).toContain('Project resource');
      expect(result).toContain(JSON.stringify(projectResource));
    });
  });

  describe('extractUserFacingContent', () => {
    it('should return content when no tool calls', () => {
      const content = 'Hello, how can I help?';
      const result = extractUserFacingContent(content);
      expect(result).toBe(content);
    });

    it('should return null when only tool calls present', () => {
      const content = '';
      const toolCalls = [{ id: '1', type: 'function', function: { name: 'test' } }];
      const result = extractUserFacingContent(content, toolCalls);
      expect(result).toBeNull();
    });

    it('should return content even with tool calls if content exists', () => {
      const content = 'Creating your project...';
      const toolCalls = [{ id: '1', type: 'function', function: { name: 'create_project' } }];
      const result = extractUserFacingContent(content, toolCalls);
      expect(result).toBe(content);
    });

    it('should return null for undefined content', () => {
      const result = extractUserFacingContent(undefined);
      expect(result).toBeNull();
    });
  });

  describe('shouldEmitToUser', () => {
    it('should return true for content without tool calls', () => {
      const content = 'User message';
      const result = shouldEmitToUser(content);
      expect(result).toBe(true);
    });

    it('should return false for empty content with tool calls', () => {
      const content = '';
      const toolCalls = [{ id: '1', type: 'function', function: { name: 'test' } }];
      const result = shouldEmitToUser(content, toolCalls);
      expect(result).toBe(false);
    });

    it('should return true for content with tool calls', () => {
      const content = 'Processing your request...';
      const toolCalls = [{ id: '1', type: 'function', function: { name: 'test' } }];
      const result = shouldEmitToUser(content, toolCalls);
      expect(result).toBe(true);
    });

    it('should return false for whitespace-only content', () => {
      const content = '   ';
      const result = shouldEmitToUser(content);
      expect(result).toBe(false);
    });
  });
});
