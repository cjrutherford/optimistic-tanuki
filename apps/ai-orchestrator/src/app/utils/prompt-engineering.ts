/**
 * Prompt Engineering Utilities
 *
 * This module contains utility functions for constructing and priming prompts
 * to ensure the LLM can accurately call tools with correct parameters.
 */

import { ProfileDto, PersonaTelosDto } from '@optimistic-tanuki/models';

/**
 * Generate tool calling primer to remind LLM about correct parameter usage
 */
export function generateToolCallingPrimer(profileId: string): string {
  return `# TOOL CALLING GUIDELINES

CRITICAL PARAMETER RULES:
- ALWAYS use userId/profileId/createdBy = ${profileId}
- When selecting projectId, ALWAYS call list_projects with userId=${profileId} first
- Use ONE tool per assistant response
- Tool calls must use exact parameter names from tool definitions
- sometimes the user will not provide the exact names or values for some parameters, it's determinant that you try to "fuzz" the value to match the expected parameter name or value as closely as possible.

RESPONSE FORMAT:
- OpenAI format tool calls are preferred: {"id":"...","type":"function","function":{"name":"tool_name","arguments":"{...}"}}
- After receiving tool results, provide a natural language summary for the user

WORKFLOW:
1. If task requires multiple steps, call tools sequentially across responses
2. Analyze each tool result before proceeding
3. On tool failure (error/isError:true), inform user and ask for clarification
4. After all tool calls complete, ALWAYS provide final natural language response

PARAMETER EXAMPLES:
✓ Correct: {"userId": "${profileId}", "name": "Project Name"}
✗ Wrong: {"userId": "some-other-id", "title": "Project Name"}`;
}

/**
 * Generate system invariants section for prompts
 */
export function generateSystemInvariants(profileId: string): string {
  return `# SYSTEM INVARIANTS (must always be followed)
- Always use userId/profileId/createdBy/members = ${profileId}
- When selecting projectId, ALWAYS call list_projects with userId=${profileId} first
- Use ONE tool per assistant response. If multiple steps required, call tools sequentially across responses.`;
}

/**
 * Generate user context section for prompts
 */
export function generateUserContext(profile: ProfileDto): string {
  return `# USER CONTEXT
userProfileId: ${profile.id}
userName: ${profile.profileName}`;
}

/**
 * Generate tool usage guidelines
 */
export function generateToolUsageGuidelines(): string {
  return `TOOL USAGE GUIDELINES:
- Use ONE tool at a time - you can only call a single tool per response
- The tool call definition in your response MUST be a valid XML document with a clear "<tool_call>" root element or JSON in OpenAI function calling format
- ALWAYS use exact parameter names as defined in the tool definitions
- If a task requires multiple steps, call one tool, wait for its response, then call the next tool
- Some tools depend on data from other tools - use the response from one tool to inform the next tool call
- After completing all necessary tool calls, ALWAYS provide a final natural language response to the user explaining what was accomplished
- Your final response should summarize the actions taken and the results`;
}

/**
 * Generate handling tool results guidelines
 */
export function generateToolResultHandling(): string {
  return `HANDLING TOOL RESULTS:
- Analyze the result of each tool call carefully.
- If a tool call fails (contains "error" or "isError": true), DO NOT proceed with dependent steps. Instead, inform the user of the error and ask for clarification or try an alternative approach if possible.
- if a tool call fails due  to an error as previously defined, attempt to correct the issue by attempting to correct the call at least once before informing the user.
- If a tool call succeeds, use the data returned to proceed to the next step or formulate your final response.
- When a tool returns a list (e.g., list_projects), check if it's empty before trying to access items.`;
}

/**
 * Generate response rules section
 */
export function generateResponseRules(profileId: string): string {
  return `# RESPONSE RULES
- If calling a tool: respond ONLY with the tool call JSON (strict). After toolReply, continue the conversation and produce a final natural-language summary for the user.
- Final user-facing messages must be plain language and include a short summary of actions taken.
- For TELOS output: append valid JSON after a literal line '---' using this schema: { "goals": [], "skills": [], "interests": [], "limitations": [], "strengths": [], "objectives": [], "coreObjective": "", "overallProfileSummary": "" }.

# EXAMPLES
- OpenAI tool_call example:
{"id":"1","type":"function","function":{"name":"create_project","arguments":"{\\"name\\":\\"My Project\\",\\"userId\\":\\"${profileId}\\"}"}}
- Successful tool_result:
{"success":true,"toolName":"create_project","result":{"id":"proj_123","name":"My Project"},"error":null}
- Failure:
{"success":false,"toolName":"create_project","result":null,"error":{"message":"Project name already exists"}}`;
}

/**
 * Generate operational limits section
 */
export function generateOperationalLimits(maxIterations: number): string {
  return `# OPERATIONAL LIMITS
- Max tool-call iterations: ${maxIterations}
- On tool failure: stop dependent steps, return an error summary and ask user for next action.`;
}

/**
 * Build complete conversation preamble
 */
export function buildConversationPreamble(
  systemPrompt: string,
  profile: ProfileDto,
  conversationSummary: string,
  maxIterations: number,
  projectResource?: any
): string {
  const parts = [
    systemPrompt,
    '',
    generateUserContext(profile),
    '',
    generateSystemInvariants(profile.id),
    '',
    generateToolUsageGuidelines(),
    '',
    generateToolResultHandling(),
    '',
    generateResponseRules(profile.id),
    '',
    `For example you can get a list of the user's projects from within the app by calling the list_projects tool with userId: ${profile.id}.`,
    '',
    generateOperationalLimits(maxIterations),
  ];

  if (projectResource) {
    parts.push('', `# Project resource: ${JSON.stringify(projectResource)}`);
  }

  return parts.join('\n');
}

/**
 * Extract message content for user display (strip tool calls)
 */
export function extractUserFacingContent(
  content: string | undefined,
  toolCalls?: any[]
): string | null {
  // If there are tool calls but no content, this is purely a tool call message
  if (
    toolCalls &&
    toolCalls.length > 0 &&
    (!content || content.trim() === '')
  ) {
    return null;
  }

  // Return the content as-is if it exists
  return content || null;
}

/**
 * Check if a message should be emitted to user
 */
export function shouldEmitToUser(
  content: string | undefined,
  toolCalls?: any[]
): boolean {
  const userContent = extractUserFacingContent(content, toolCalls);
  return userContent !== null && userContent.trim().length > 0;
}
