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

    it('should enhance userId parameter description with user profile ID', () => {
      const mcpTool: McpTool = {
        name: 'create_project',
        description: 'Create a new project',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The ID of the user creating the project',
            },
          },
          required: ['userId'],
        },
      };

      const result = transformMcpToolToOpenAI(mcpTool, 'user-123');

      expect(result.function.parameters.properties.userId.description).toBe(
        "The ID of the user creating the project. ALWAYS use the current user's profile ID: user-123"
      );
    });

    it('should enhance members parameter description with user profile ID', () => {
      const mcpTool: McpTool = {
        name: 'create_project',
        description: 'Create a new project',
        inputSchema: {
          type: 'object',
          properties: {
            members: {
              type: 'array',
              description: 'Array of member IDs to add to the project',
            },
          },
        },
      };

      const result = transformMcpToolToOpenAI(mcpTool, 'user-456');

      expect(result.function.parameters.properties.members.description).toBe(
        "Array of member IDs to add to the project. ALWAYS include the current user's profile ID: [user-456]"
      );
    });

    it('should enhance both userId and members when both are present', () => {
      const mcpTool: McpTool = {
        name: 'create_project',
        description: 'Create a new project',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The ID of the user',
            },
            members: {
              type: 'array',
              description: 'Array of member IDs',
            },
          },
        },
      };

      const result = transformMcpToolToOpenAI(mcpTool, 'user-789');

      expect(
        result.function.parameters.properties.userId.description
      ).toContain('user-789');
      expect(
        result.function.parameters.properties.members.description
      ).toContain('[user-789]');
    });

    it('should enhance projectId parameter with list_projects instruction', () => {
      const mcpTool: McpTool = {
        name: 'create_task',
        description: 'Create a new task',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'The ID of the project',
            },
          },
        },
      };

      const result = transformMcpToolToOpenAI(mcpTool, 'user-123');

      expect(
        result.function.parameters.properties.projectId.description
      ).toContain('list_projects');
      expect(
        result.function.parameters.properties.projectId.description
      ).toContain('user-123');
    });

    it('should enhance createdBy parameter with user profile ID', () => {
      const mcpTool: McpTool = {
        name: 'create_task',
        description: 'Create a new task',
        inputSchema: {
          type: 'object',
          properties: {
            createdBy: {
              type: 'string',
              description: 'User who created the task',
            },
          },
        },
      };

      const result = transformMcpToolToOpenAI(mcpTool, 'user-456');

      expect(
        result.function.parameters.properties.createdBy.description
      ).toContain('ALWAYS');
      expect(
        result.function.parameters.properties.createdBy.description
      ).toContain('user-456');
    });

    it('should enhance tool description for project-dependent tools', () => {
      const mcpTool: McpTool = {
        name: 'create_task',
        description: 'Create a new task',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      const result = transformMcpToolToOpenAI(mcpTool, 'user-123');

      expect(result.function.description).toContain('list_projects');
      expect(result.function.description).toContain('NOTE:');
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

    it('should enhance all tools with user profile ID when provided', () => {
      const mcpTools: McpTool[] = [
        {
          name: 'tool1',
          description: 'First tool',
          inputSchema: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
                description: 'User ID',
              },
            },
          },
        },
        {
          name: 'tool2',
          description: 'Second tool',
          inputSchema: {
            type: 'object',
            properties: {
              members: {
                type: 'array',
                description: 'Members',
              },
            },
          },
        },
      ];

      const result = transformMcpToolsToOpenAI(mcpTools, 'user-999');

      expect(
        result[0].function.parameters.properties.userId.description
      ).toContain('user-999');
      expect(
        result[1].function.parameters.properties.members.description
      ).toContain('[user-999]');
    });
  });
});
