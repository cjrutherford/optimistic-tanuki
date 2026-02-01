// Lightweight mocks for heavy langchain/langgraph packages to reduce test memory usage
// These mocks prevent actual LLM connections and reduce memory footprint significantly

// Mock the langgraph package - minimal implementation to prevent loading heavy dependencies
jest.mock('@langchain/langgraph', () => {
  class MockStateGraph {
    addNode() {
      return this; // Chainable
    }
    addEdge() {
      return this; // Chainable
    }
    compile() {
      // Return a minimal mock compiled graph that won't consume memory
      return {
        invoke: async (initialState: any) => {
          // Return state immediately without processing
          return {
            ...initialState,
            recentTopics: initialState.recentTopics || [],
            summary: initialState.summary || '',
            chatHistory: initialState.chatHistory || [],
          };
        },
      };
    }
  }

  return {
    StateGraph: MockStateGraph,
    START: 'START',
    END: 'END',
    Annotation: {
      Root: (spec: any) => ({ State: spec }),
    },
  };
});

// Mock prebuilt createReactAgent - ultra lightweight to prevent OOM
jest.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: () => ({
    stream: async function* (_inputs: any) {
      // Minimal yield to satisfy iterator contract
      yield { messages: [] };
    },
    invoke: async () => ({
      messages: [{ role: 'assistant', content: 'mock' }],
    }),
    isInitialized: () => true,
  }),
}));

// Mock ollama LLM client - prevents connection attempts
jest.mock('@langchain/ollama', () => ({
  ChatOllama: class MockChatOllama {
    constructor(_opts: any) {}
    async invoke(_messages: any[]) {
      return { content: 'mock response', tool_calls: [] };
    }
    bindTools(_tools: any[]) {
      return this;
    }
    async *stream(_messages: any[]) {
      yield { content: 'mock' };
    }
  },
}));

// Mock core prompt/template and tools - ultra lightweight
jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: () => ({ invoke: async () => '' }),
  },
}));

jest.mock('@langchain/core/tools', () => ({
  DynamicStructuredTool: class MockTool {
    name: string;
    description: string;
    schema: any;
    func: Function;
    constructor(opts: any) {
      this.name = opts.name;
      this.description = opts.description;
      this.schema = opts.schema;
      this.func = opts.func;
    }
  },
}));

// Mock zod-to-json-schema to prevent loading heavy validation library
jest.mock('zod-to-json-schema', () => ({
  zodToJsonSchema: (schema: any) => ({ type: 'object', properties: {} }),
}));

// Mock messages - minimal container classes
jest.mock('@langchain/core/messages', () => {
  class BaseMessage {
    content: string;
    role: string;
    constructor(content: any, role = 'user') {
      this.content = String(content);
      this.role = role;
    }
    toString() {
      return this.content;
    }
  }
  class HumanMessage extends BaseMessage {
    constructor(content: any) {
      super(content, 'user');
    }
  }
  class AIMessage extends BaseMessage {
    constructor(content: any) {
      super(content, 'assistant');
    }
  }
  return { BaseMessage, HumanMessage, AIMessage };
});

// Mock Redis to prevent connection attempts and reduce memory
jest.mock('redis', () => ({
  createClient: () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    setEx: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    on: jest.fn(),
  }),
}));

// Silence console noise in tests to reduce memory from string allocations
const noop = () => {};
global.console.debug = noop;
global.console.info = noop;
global.console.warn = noop;
