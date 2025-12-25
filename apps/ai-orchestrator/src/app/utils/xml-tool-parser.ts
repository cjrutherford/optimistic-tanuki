/**
 * XML Tool Call Parser
 * 
 * Parses XML-formatted tool calls from LLM responses.
 * Supports formats like:
 * <tool_call>
 *   <name>tool_name</name>
 *   <arguments>
 *     <arg_name>value</arg_name>
 *   </arguments>
 * </tool_call>
 */

export interface ParsedXmlToolCall {
  name: string;
  arguments: Record<string, any>;
}

/**
 * Parse XML tool call from string
 */
export function parseXmlToolCall(xmlString: string): ParsedXmlToolCall | null {
  try {
    // Basic XML parsing without external dependencies
    const toolCallMatch = xmlString.match(
      /<tool_call>([\s\S]*?)<\/tool_call>/
    );
    
    if (!toolCallMatch) {
      return null;
    }

    const toolCallContent = toolCallMatch[1];

    // Extract tool name
    const nameMatch = toolCallContent.match(/<name>(.*?)<\/name>/);
    if (!nameMatch) {
      return null;
    }
    const name = nameMatch[1].trim();

    // Extract arguments
    const argsMatch = toolCallContent.match(
      /<arguments>([\s\S]*?)<\/arguments>/
    );
    
    const args: Record<string, any> = {};
    
    if (argsMatch) {
      const argsContent = argsMatch[1];
      
      // Parse individual argument tags
      const argPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
      let match;
      
      while ((match = argPattern.exec(argsContent)) !== null) {
        const argName = match[1];
        const argValue = match[2].trim();
        
        // Try to parse as JSON if it looks like an object or array
        if (
          (argValue.startsWith('{') && argValue.endsWith('}')) ||
          (argValue.startsWith('[') && argValue.endsWith(']'))
        ) {
          try {
            args[argName] = JSON.parse(argValue);
          } catch {
            args[argName] = argValue;
          }
        } else if (argValue === 'true' || argValue === 'false') {
          args[argName] = argValue === 'true';
        } else if (!isNaN(Number(argValue)) && argValue !== '') {
          args[argName] = Number(argValue);
        } else {
          args[argName] = argValue;
        }
      }
    }

    return { name, arguments: args };
  } catch (error) {
    return null;
  }
}

/**
 * Check if string contains XML tool call
 */
export function containsXmlToolCall(content: string): boolean {
  return /<tool_call>[\s\S]*?<\/tool_call>/.test(content);
}

/**
 * Extract all XML tool calls from content
 */
export function extractAllXmlToolCalls(
  content: string
): ParsedXmlToolCall[] {
  const toolCalls: ParsedXmlToolCall[] = [];
  const pattern = /<tool_call>[\s\S]*?<\/tool_call>/g;
  const matches = content.match(pattern);

  if (matches) {
    for (const match of matches) {
      const parsed = parseXmlToolCall(match);
      if (parsed) {
        toolCalls.push(parsed);
      }
    }
  }

  return toolCalls;
}

/**
 * Strip XML tool calls from content to get user-facing message
 */
export function stripXmlToolCalls(content: string): string {
  return content.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
}

/**
 * Convert parsed XML tool call to OpenAI format
 */
export function xmlToolCallToOpenAI(
  xmlToolCall: ParsedXmlToolCall,
  id?: string
): {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
} {
  return {
    id: id || `xml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'function',
    function: {
      name: xmlToolCall.name,
      arguments: JSON.stringify(xmlToolCall.arguments),
    },
  };
}
