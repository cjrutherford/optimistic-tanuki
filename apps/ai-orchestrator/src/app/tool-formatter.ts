/**
 * Utility functions to transform MCP tools to OpenAI function calling format
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties?: Record<string, any>;
      required?: string[];
      [key: string]: any;
    };
  };
}

/**
 * Transform a single MCP tool to OpenAI function format
 */
export function transformMcpToolToOpenAI(mcpTool: McpTool): OpenAITool {
  return {
    type: 'function',
    function: {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters: mcpTool.inputSchema,
    },
  };
}

/**
 * Transform an array of MCP tools to OpenAI function format
 */
export function transformMcpToolsToOpenAI(mcpTools: McpTool[]): OpenAITool[] {
  return mcpTools.map(transformMcpToolToOpenAI);
}
