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
 * Enhance tool parameter descriptions with user context
 */
function enhanceParameterDescriptions(
  parameters: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  },
  userProfileId: string
): {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  [key: string]: any;
} {
  if (!parameters.properties) {
    return parameters;
  }

  const enhancedProperties = { ...parameters.properties };

  // Enhance userId parameter
  if (enhancedProperties.userId) {
    enhancedProperties.userId = {
      ...enhancedProperties.userId,
      description: `${enhancedProperties.userId.description || 'User ID'}. Use the current user's profile ID: ${userProfileId}`,
    };
  }

  // Enhance profileId parameter
  if (enhancedProperties.profileId) {
    enhancedProperties.profileId = {
      ...enhancedProperties.profileId,
      description: `${enhancedProperties.profileId.description || 'Profile ID'}. Use the current user's profile ID: ${userProfileId}`,
    };
  }

  // Enhance members array parameter
  if (enhancedProperties.members) {
    enhancedProperties.members = {
      ...enhancedProperties.members,
      description: `${enhancedProperties.members.description || 'Array of member IDs'}. For now, include only the current user's profile ID: [${userProfileId}]`,
    };
  }

  return {
    ...parameters,
    properties: enhancedProperties,
  };
}

/**
 * Transform a single MCP tool to OpenAI function format
 */
export function transformMcpToolToOpenAI(mcpTool: McpTool, userProfileId?: string): OpenAITool {
  let parameters = mcpTool.inputSchema;
  
  // Enhance parameter descriptions if user context is provided
  if (userProfileId) {
    parameters = enhanceParameterDescriptions(parameters, userProfileId);
  }

  return {
    type: 'function',
    function: {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters,
    },
  };
}

/**
 * Transform an array of MCP tools to OpenAI function format
 */
export function transformMcpToolsToOpenAI(mcpTools: McpTool[], userProfileId?: string): OpenAITool[] {
  return mcpTools.map(tool => transformMcpToolToOpenAI(tool, userProfileId));
}
