/**
 * Prompt Engineering Utilities
 *
 * This module contains utility functions for constructing and priming prompts
 * to ensure the LLM can accurately call tools with correct parameters.
 */

import { ProfileDto } from '@optimistic-tanuki/models';

/**
 * Generate the core system prompt including user context and strict invariants
 */
export function generateCoreSystemPrompt(profile: ProfileDto): string {
  return `# USER CONTEXT
User ID: ${profile.id}
User Name: ${profile.profileName}

# OPERATIONAL PROTOCOLS
1. **THINK-ACT LOOP**:
   - **THINK**: What do I need? (e.g., "I need a projectId")
   - **ACT**: Call a tool to get it. (e.g., "list_projects")
   - **OBSERVE**: Use the tool result.
   - **REFINE**: If failed, try a different query or tool.

2. **STRICT ID VERIFICATION**:
   - **NEVER** invent or hallucinate IDs (UUIDs).
   - If you need an ID (projectId, taskId, etc.), you **MUST** first call a 'list' or 'query' tool to find it.
   - Example: To add a task to "Project Alpha", first call \`query_projects\` with name="Alpha", get the ID, THEN call \`create_task\`.

3. **PARAMETER RULES**:
   - **ALWAYS** use userId/profileId/createdBy = "${profile.id}"
   - Use exact parameter names from the tool definitions.

4. **TOOL USAGE**:
   - Use **ONE** tool per response.
   - If you don't see a tool you need, call \`list_tools\` to check available capabilities.
   - **create_project** IS available for creating new projects. Use it.

5. **RESPONSE FORMAT**:
   - For tool calls: Return ONLY the JSON tool call.
   - For final answers: Provide a helpful natural language summary.
`;
}

/**
 * Generate concise tool usage guidelines to save tokens
 */
export function generateToolingGuidance(): string {
  return `# TOOL GUIDANCE
- **create_project**: Use for new projects. Requires 'name' and 'userId'.
- **list_projects**: Use to find project IDs.
- **query_projects**: Use to search projects by name.
- **create_task**: Add tasks to projects (requires projectId).
- **create_risk**: Add risks to projects (requires projectId).
- **create_change**: Create change requests (requires projectId).
- **list_tools**: Discovery tool. Use this if unsure about tool names/params.

**ERROR HANDLING**:
- If a tool fails with "Missing ID", you likely skipped the "Find ID" step. Go back and list/query first.
- If a tool is "not available", check \`list_tools\`. It might be named slightly differently.
`;
}

/**
 * Build complete conversation preamble (Legacy support)
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
    generateCoreSystemPrompt(profile),
    '',
    generateToolingGuidance(),
    '',
    `# CONVERSATION SUMMARY\n${conversationSummary}`,
    '',
    `# OPERATIONAL LIMITS\nMax iterations: ${maxIterations}`,
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
  if (toolCalls && toolCalls.length > 0 && (!content || content.trim() === '')) {
    return null;
  }
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