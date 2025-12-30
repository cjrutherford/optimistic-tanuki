// Lightweight mocks for heavy langchain/langgraph packages to reduce test memory usage

// Mock the langgraph package
jest.mock('@langchain/langgraph', () => {
  class MockStateGraph {
    constructor() {}
    addNode() {}
    addEdge() {}
    compile() {
      // Return a simple object with an invoke method that returns the passed state
      return {
        invoke: async (initialState: any) => {
          // Provide sensible defaults used by code under test
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

// Mock prebuilt createReactAgent
jest.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: () => {
    // Minimal agent stub with required methods
    return {
      stream: async function* (inputs: any, _opts: any) {
        // Yield a single final-state-like chunk that mirrors the input messages
        // and provides minimal fields expected by the MCP validator and agent code.
        const incomingMessages = (inputs && inputs.messages) || [];

        const toMessageObject = (m: any) => {
          const role = m.role || 'user';
          const content = m.content || (typeof m === 'string' ? m : '');

          const obj: any = {
            role,
            content:
              typeof content === 'string' ? content : JSON.stringify(content),
            // Simple helper used in agent to detect tool outputs
            _getType: () =>
              role === 'tool'
                ? 'tool'
                : role === 'assistant'
                ? 'assistant'
                : role,
          };

          // If this is a tool message, include a tool_call_id and optional name
          if (role === 'tool') {
            obj.tool_call_id = m.tool_call_id || `call_mock_${Date.now()}`;
            obj.name = m.name || 'mock_tool';
          }

          // If this is an assistant message that contains tool_calls, make sure they have ids
          if (role === 'assistant' && m.tool_calls) {
            obj.tool_calls = m.tool_calls.map((tc: any, idx: number) => ({
              id:
                tc.id && tc.id.length > 0 ? tc.id : `call_${Date.now()}_${idx}`,
              type: tc.type || 'function',
              function: tc.function || {
                name: tc.name || 'mock_fn',
                arguments: tc.arguments || '{}',
              },
              // also expose a convenience name
              name: (tc.function && tc.function.name) || tc.name || 'mock_fn',
            }));
          }

          return obj;
        };

        // Build chunk
        const chunk = {
          messages: incomingMessages.map(toMessageObject),
        };

        // Yield a brief initial progress chunk and then the final chunk
        yield { messages: [] };
        yield chunk;
      },
      invoke: async (opts: any) => {
        const msgs = (opts && opts.messages) || [
          { role: 'assistant', content: 'mock' },
        ];
        return {
          messages: msgs.map((m: any) => ({
            role: m.role || 'assistant',
            content: m.content || 'mock',
          })),
        };
      },
      isInitialized: () => true,
    };
  },
}));

// Mock ollama LLM client
jest.mock('@langchain/ollama', () => ({
  ChatOllama: class {
    constructor(_opts: any) {}
    // minimal interface if used
  },
}));

// Mock core prompt/template and tools to lightweight implementations
jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: (messages: any[]) =>
      messages.map((m) => (m.content ? m.content : m)).join('\n'),
  },
}));

jest.mock('@langchain/core/tools', () => ({
  DynamicStructuredTool: class {
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

// Mock messages - simple container classes used by AppService
jest.mock('@langchain/core/messages', () => {
  class BaseMessage {
    content: any;
    role: string;
    constructor(content: any, role = 'user') {
      this.content = content;
      this.role = role;
    }
    toString() {
      return String(this.content);
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

// Provide a noop for community package if required
jest.mock('@langchain/community', () => ({}));

// Silence console noise in tests
const noop = () => {};
console.debug = noop;
console.info = noop;
console.warn = noop;
