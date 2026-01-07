/**
 * Rate Limit Guard Tests
 *
 * Tests for the AI Orchestrator rate limiting functionality
 */

import { ExecutionContext } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RateLimitGuard } from './rate-limit.guard';
import { Reflector } from '@nestjs/core';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RateLimitGuard(
      {
        ttl: 60000,
        limit: 10,
        ignoreUserAgents: [],
        skipIf: () => false,
        throttlers: [{ ttl: 60000, limit: 10 }],
      },
      reflector,
      {} as any
    );
  });

  describe('getTracker', () => {
    it('should extract profileId as tracker', async () => {
      const req = { profileId: 'profile-123' };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('profile-123');
    });

    it('should extract userId as fallback tracker', async () => {
      const req = { userId: 'user-456' };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('user-456');
    });

    it('should extract first participant from conversation', async () => {
      const req = {
        conversation: {
          participants: ['participant-789', 'participant-999'],
        },
      };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('participant-789');
    });

    it('should use global as fallback when no identifier found', async () => {
      const req = {};
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('global');
    });
  });

  describe('throwThrottlingException', () => {
    it('should throw RpcException when rate limit exceeded', async () => {
      const context = {} as ExecutionContext;
      await expect(
        (guard as any).throwThrottlingException(context)
      ).rejects.toThrow(RpcException);
      await expect(
        (guard as any).throwThrottlingException(context)
      ).rejects.toThrow('Rate limit exceeded');
    });
  });
});
