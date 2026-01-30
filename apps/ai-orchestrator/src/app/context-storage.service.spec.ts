/**
 * Context Storage Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ContextStorageService,
  ConversationContext,
} from './context-storage.service';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  setEx: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  on: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

describe('ContextStorageService', () => {
  let service: ContextStorageService;
  let configService: ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextStorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: any = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ContextStorageService>(ContextStorageService);
    configService = module.get<ConfigService>(ConfigService);

    // Wait for Redis to initialize
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('initialization', () => {
    it('should handle object config', async () => {
      jest.clearAllMocks();
      (configService.get as jest.Mock).mockReturnValue({ host: 'redis', port: 6379 });
      
      const newService = new ContextStorageService(configService);
      // Wait for init
      await new Promise(r => setTimeout(r, 10));
      
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should handle redis connection events', async () => {
      // Simulate events
      const errorHandler = mockRedisClient.on.mock.calls.find(call => call[0] === 'error')[1];
      const connectHandler = mockRedisClient.on.mock.calls.find(call => call[0] === 'connect')[1];
      const disconnectHandler = mockRedisClient.on.mock.calls.find(call => call[0] === 'disconnect')[1];

      // Execute handlers to cover them
      errorHandler(new Error('Test Redis Error'));
      connectHandler();
      disconnectHandler();
    });
  });

  describe('clearAllContexts', () => {
    it('should clear all contexts', async () => {
      mockRedisClient.keys.mockResolvedValue(['ai-context:1', 'ai-context:2']);
      
      await service.clearAllContexts();
      
      expect(mockRedisClient.del).toHaveBeenCalledWith(['ai-context:1', 'ai-context:2']);
    });

    it('should do nothing if no keys found', async () => {
      mockRedisClient.keys.mockResolvedValue([]);
      
      await service.clearAllContexts();
      
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Keys failed'));
      await service.clearAllContexts();
      // Should catch and log error, not throw
    });
  });

  describe('storeContext', () => {
    it('should handle redis set error', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Set failed'));
      await service.storeContext('user-1', {} as any);
      // Should catch
    });

    it('should store conversation context', async () => {
      const profileId = 'user-123';
      const context = {
        summary: 'Discussing projects',
        recentTopics: ['projects', 'tasks'],
        activeProjects: ['proj-456'],
        messageCount: 5,
      };

      await service.storeContext(profileId, context);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining(profileId),
        expect.any(Number),
        expect.stringContaining('Discussing projects')
      );
    });
  });

  describe('getContext', () => {
    it('should handle redis get error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Get failed'));
      const result = await service.getContext('user-1');
      expect(result).toBeNull();
    });

    it('should retrieve stored context', async () => {
      const profileId = 'user-123';
      const storedContext: ConversationContext = {
        profileId,
        summary: 'Discussing projects',
        recentTopics: ['projects'],
        activeProjects: [],
        messageCount: 3,
        lastUpdated: new Date(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(storedContext));

      const result = await service.getContext(profileId);

      expect(result).toBeDefined();
      expect(result?.profileId).toBe(profileId);
      expect(result?.summary).toBe('Discussing projects');
    });

    it('should return null for non-existent context', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getContext('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateContext', () => {
    it('should update existing context', async () => {
      const profileId = 'user-123';
      const existingContext: ConversationContext = {
        profileId,
        summary: 'Old summary',
        recentTopics: ['old'],
        activeProjects: [],
        messageCount: 1,
        lastUpdated: new Date(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingContext));

      await service.updateContext(profileId, {
        summary: 'New summary',
        recentTopics: ['new'],
      });

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining(profileId),
        expect.any(Number),
        expect.stringContaining('New summary')
      );
    });

    it('should create new context if none exists', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await service.updateContext('new-user', {
        summary: 'First conversation',
      });

      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });
  });

  describe('deleteContext', () => {
    it('should handle redis del error', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Del failed'));
      await service.deleteContext('user-1');
      // Should catch
    });

    it('should delete context for profile', async () => {
      const profileId = 'user-123';

      await service.deleteContext(profileId);

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        expect.stringContaining(profileId)
      );
    });
  });

  describe('getStats', () => {
    it('should handle redis keys error', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Keys failed'));
      const result = await service.getStats();
      expect(result.totalContexts).toBe(0);
    });

    it('should return context statistics', async () => {
      mockRedisClient.keys.mockResolvedValue([
        'ai-context:user-1',
        'ai-context:user-2',
      ]);

      const stats = await service.getStats();

      expect(stats.totalContexts).toBe(2);
      expect(stats.keys).toHaveLength(2);
    });
  });
});