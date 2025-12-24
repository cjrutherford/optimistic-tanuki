import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolDefinition } from '@optimistic-tanuki/models';

/**
 * Utility functions to transform MCP tools to OpenAI function calling format
 */

// Re-export the ToolDefinition type for backward compatibility
export type OpenAITool = ToolDefinition;

// Keep the old interface name for internal use
export interface McpTool extends Tool {}

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

  // Enhance userId parameter - always use current user
  if (enhancedProperties.userId) {
    enhancedProperties.userId = {
      ...enhancedProperties.userId,
      description: `${
        enhancedProperties.userId.description || 'User ID'
      }. ALWAYS use the current user's profile ID: ${userProfileId}`,
    };
  }

  // Enhance profileId parameter - always use current user
  if (enhancedProperties.profileId) {
    enhancedProperties.profileId = {
      ...enhancedProperties.profileId,
      description: `${
        enhancedProperties.profileId.description || 'Profile ID'
      }. ALWAYS use the current user's profile ID: ${userProfileId}`,
    };
  }

  // Enhance createdBy parameter - always use current user
  if (enhancedProperties.createdBy) {
    enhancedProperties.createdBy = {
      ...enhancedProperties.createdBy,
      description: `${
        enhancedProperties.createdBy.description || 'User who created this item'
      }. ALWAYS use the current user's profile ID: ${userProfileId}`,
    };
  }

  // Enhance members array parameter - always include current user
  if (enhancedProperties.members) {
    enhancedProperties.members = {
      ...enhancedProperties.members,
      description: `${
        enhancedProperties.members.description || 'Array of member IDs'
      }. ALWAYS include the current user's profile ID: [${userProfileId}]`,
    };
  }

  // Enhance projectId parameter - must list projects first
  if (enhancedProperties.projectId) {
    enhancedProperties.projectId = {
      ...enhancedProperties.projectId,
      description: `${
        enhancedProperties.projectId.description || 'Project ID'
      }. You MUST first call 'list_projects' with userId: ${userProfileId} to get available project IDs, then select the appropriate project from the response.`,
    };
  }

  return {
    ...parameters,
    properties: enhancedProperties,
  };
}

/**
 * Enhance tool description based on tool name and dependencies
 */
function enhanceToolDescription(
  toolName: string,
  originalDescription: string
): string {
  // Tools that depend on projects
  const projectDependentTools = [
    'create_task',
    'list_tasks',
    'create_risk',
    'list_risks',
    'create_change',
    'list_changes',
    'list_journal_entries',
    'create_journal_entry',
  ];

  if (
    projectDependentTools.some(
      (dep) => toolName.includes(dep) || dep.includes(toolName)
    )
  ) {
    return `${originalDescription} NOTE: This tool operates on a specific project. You MUST call 'list_projects' first to identify available projects before using this tool.`;
  }

  return originalDescription;
}

/**
 * Transform a single MCP tool to OpenAI function format
 */
export function transformMcpToolToOpenAI(
  mcpTool: Tool,
  userProfileId?: string
): OpenAITool {
  let parameters: any = mcpTool.inputSchema;
  let description = mcpTool.description || '';

  // Enhance parameter descriptions and tool description if user context is provided
  if (userProfileId) {
    parameters = enhanceParameterDescriptions(parameters, userProfileId);
    description = enhanceToolDescription(mcpTool.name, description);
  }

  return {
    type: 'function',
    function: {
      name: mcpTool.name,
      description,
      parameters,
    },
  };
}

/**
 * Transform an array of MCP tools to OpenAI function format
 */
export function transformMcpToolsToOpenAI(
  mcpTools: Tool[],
  userProfileId?: string
): OpenAITool[] {
  return mcpTools.map((tool) => transformMcpToolToOpenAI(tool, userProfileId));
}
