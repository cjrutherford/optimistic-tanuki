import { Test, TestingModule } from '@nestjs/testing';
import { LangGraphService } from './langgraph.service';
import { ContextStorageService } from './context-storage.service';
import { LangChainService } from './langchain.service';
import { LangChainAgentService } from './langchain-agent.service';

// Mock @langchain/core/messages
jest.mock('@langchain/core/messages', () => {
  return {
    HumanMessage: jest.fn().mockImplementation((content) => ({ content })),
    AIMessage: jest.fn().mockImplementation((content) => ({ content })),
  };
});

// Mock StateGraph and other exports from @langchain/langgraph
jest.mock('@langchain/langgraph', () => {
  return {
    StateGraph: jest.fn().mockImplementation(() => ({
      addNode: jest.fn(),
      addEdge: jest.fn(),
      compile: jest.fn().mockReturnValue({
        invoke: jest.fn().mockImplementation(async (state) => ({
          ...state,
          recentTopics: ['test-topic'], // Mock graph result
          chatHistory: state.chatHistory || [],
        })),
      }),
    })),
    START: 'START',
    END: 'END',
    Annotation: Object.assign(
      jest.fn().mockImplementation((config) => config),
      {
        Root: jest.fn().mockImplementation((config) => config),
      }
    ),
  };
});

describe('LangGraphService', () => {
  let service: LangGraphService;
  let contextStorage: ContextStorageService;
  let langchain: LangChainService;
  let agent: LangChainAgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LangGraphService,
        {
          provide: ContextStorageService,
          useValue: {
            getContext: jest.fn().mockResolvedValue({ summary: 'old summary' }),
            storeContext: jest.fn().mockResolvedValue(undefined),
            deleteContext: jest.fn().mockResolvedValue(undefined),
            getStats: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: LangChainService,
          useValue: {
            executeConversation: jest
              .fn()
              .mockResolvedValue({
                response: 'Direct response',
                toolCalls: [],
              }),
          },
        },
        {
          provide: LangChainAgentService,
          useValue: {
            executeAgent: jest
              .fn()
              .mockResolvedValue({ output: 'Agent response', toolCalls: [] }),
            isInitialized: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<LangGraphService>(LangGraphService);
    contextStorage = module.get<ContextStorageService>(ContextStorageService);
    langchain = module.get<LangChainService>(LangChainService);
    agent = module.get<LangChainAgentService>(LangChainAgentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeConversation', () => {
    const mockMessages = [{ content: 'Hello' }] as any;
    const mockProfile = { id: 'user-1' } as any;
    const mockPersona = { id: 'persona-1' } as any;

    it('should use agent if useAgent is true and initialized', async () => {
      const result = await service.executeConversation(
        'user-1',
        mockMessages,
        [],
        mockPersona,
        mockProfile,
        'conv-1',
        true
      );

      expect(agent.executeAgent).toHaveBeenCalled();
      expect(result.response).toBe('Agent response');
    });

    it('should use direct langchain if useAgent is false', async () => {
      const result = await service.executeConversation(
        'user-1',
        mockMessages,
        [],
        mockPersona,
        mockProfile,
        'conv-1',
        false
      );

      expect(langchain.executeConversation).toHaveBeenCalled();
      expect(result.response).toBe('Direct response');
    });
  });

  describe('Internal Nodes', () => {
    // Helper to access private methods
    const getPrivate = () => service as any;

    it('loadContextNode should load context', async () => {
      const result = await getPrivate().loadContextNode({
        profileId: 'user-1',
      });
      expect(contextStorage.getContext).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        summary: 'old summary',
        // other fields optional/undefined in mock
        recentTopics: undefined,
        activeProjects: undefined,
        metadata: {},
      });
    });

    it('extractTopicsNode should extract topics', async () => {
      const state = {
        messages: [{ content: 'Create a project for the task risk' }],
      };
      const result = await getPrivate().extractTopicsNode(state);
      expect(result.recentTopics).toContain('projects');
      expect(result.recentTopics).toContain('tasks');
      expect(result.recentTopics).toContain('risks');
    });

    it('updateSummaryNode should create summary', async () => {
      const state = {
        messages: [{ content: 'User message' }],
        recentTopics: ['topic1'],
      };
      const result = await getPrivate().updateSummaryNode(state);
      expect(result.summary).toContain('User message');
      expect(result.summary).toContain('topic1');
    });

    it('saveContextNode should save context', async () => {
      const state = {
        profileId: 'user-1',
        summary: 'sum',
        recentTopics: [],
        activeProjects: [],
        messages: [],
        metadata: {},
      };
      await getPrivate().saveContextNode(state);
      expect(contextStorage.storeContext).toHaveBeenCalledWith(
        'user-1',
        expect.any(Object)
      );
    });
  });

  describe('Context Management', () => {
    it('getProfileContext should delegate to contextStorage', async () => {
      await service.getProfileContext('user-1');
      expect(contextStorage.getContext).toHaveBeenCalledWith('user-1');
    });

    it('clearProfileContext should delegate to contextStorage', async () => {
      await service.clearProfileContext('user-1');
      expect(contextStorage.deleteContext).toHaveBeenCalledWith('user-1');
    });

    it('getContextStats should delegate to contextStorage', async () => {
      await service.getContextStats();
      expect(contextStorage.getStats).toHaveBeenCalled();
    });
  });
});
