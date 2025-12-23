import {
  transformMcpToolToOpenAI,
  transformMcpToolsToOpenAI,
  McpTool,
  OpenAITool,
} from './tool-formatter';

describe('Tool Formatter', () => {
  describe('transformMcpToolToOpenAI', () => {
    it('should transform a simple MCP tool to OpenAI format', () => {
      const mcpTool: McpTool = {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
          },
          required: ['location'],
        },
      };

      const result = transformMcpToolToOpenAI(mcpTool);

      expect(result).toEqual({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA',
              },
            },
            required: ['location'],
          },
        },
      });
    });

    it('should transform an MCP tool with multiple parameters', () => {
      const mcpTool: McpTool = {
        name: 'create_project',
        description: 'Create a new project',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The name of the project',
            },
            description: {
              type: 'string',
              description: 'A description of the project',
            },
            userId: {
              type: 'string',
              description: 'The ID of the user creating the project',
            },
          },
          required: ['name', 'userId'],
        },
      };

      const result = transformMcpToolToOpenAI(mcpTool);

      expect(result.type).toBe('function');
      expect(result.function.name).toBe('create_project');
      expect(result.function.parameters.required).toEqual(['name', 'userId']);
    });

    it('should preserve additional schema properties', () => {
      const mcpTool: McpTool = {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {
            param: { type: 'string' },
          },
          additionalProperties: false,
          minProperties: 1,
        },
      };

      const result = transformMcpToolToOpenAI(mcpTool);

      expect(result.function.parameters.additionalProperties).toBe(false);
      expect(result.function.parameters.minProperties).toBe(1);
    });
  });

  describe('transformMcpToolsToOpenAI', () => {
    it('should transform an empty array', () => {
      const result = transformMcpToolsToOpenAI([]);
      expect(result).toEqual([]);
    });

    it('should transform multiple MCP tools', () => {
      const mcpTools: McpTool[] = [
        {
          name: 'tool1',
          description: 'First tool',
          inputSchema: {
            type: 'object',
            properties: { param1: { type: 'string' } },
          },
        },
        {
          name: 'tool2',
          description: 'Second tool',
          inputSchema: {
            type: 'object',
            properties: { param2: { type: 'number' } },
          },
        },
      ];

      const result = transformMcpToolsToOpenAI(mcpTools);

      expect(result).toHaveLength(2);
      expect(result[0].function.name).toBe('tool1');
      expect(result[1].function.name).toBe('tool2');
      result.forEach((tool) => {
        expect(tool.type).toBe('function');
      });
    });
  });
});
