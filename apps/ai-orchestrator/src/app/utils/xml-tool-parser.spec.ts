/**
 * Tests for XML Tool Call Parser
 */

import {
  parseXmlToolCall,
  containsXmlToolCall,
  extractAllXmlToolCalls,
  stripXmlToolCalls,
  xmlToolCallToOpenAI,
} from './xml-tool-parser';

describe('XML Tool Call Parser', () => {
  describe('parseXmlToolCall', () => {
    it('should parse a simple XML tool call', () => {
      const xml = `
        <tool_call>
          <name>create_project</name>
          <arguments>
            <name>My Project</name>
            <userId>user-123</userId>
          </arguments>
        </tool_call>
      `;

      const result = parseXmlToolCall(xml);
      expect(result).toEqual({
        name: 'create_project',
        arguments: {
          name: 'My Project',
          userId: 'user-123',
        },
      });
    });

    it('should parse XML with numeric values', () => {
      const xml = `
        <tool_call>
          <name>update_task</name>
          <arguments>
            <taskId>123</taskId>
            <priority>5</priority>
          </arguments>
        </tool_call>
      `;

      const result = parseXmlToolCall(xml);
      expect(result).toEqual({
        name: 'update_task',
        arguments: {
          taskId: 123,
          priority: 5,
        },
      });
    });

    it('should parse XML with boolean values', () => {
      const xml = `
        <tool_call>
          <name>set_status</name>
          <arguments>
            <active>true</active>
            <archived>false</archived>
          </arguments>
        </tool_call>
      `;

      const result = parseXmlToolCall(xml);
      expect(result).toEqual({
        name: 'set_status',
        arguments: {
          active: true,
          archived: false,
        },
      });
    });

    it('should parse XML with JSON objects', () => {
      const xml = `
        <tool_call>
          <name>create_item</name>
          <arguments>
            <metadata>{"key": "value", "count": 42}</metadata>
          </arguments>
        </tool_call>
      `;

      const result = parseXmlToolCall(xml);
      expect(result).toEqual({
        name: 'create_item',
        arguments: {
          metadata: { key: 'value', count: 42 },
        },
      });
    });

    it('should parse XML with arrays', () => {
      const xml = `
        <tool_call>
          <name>add_members</name>
          <arguments>
            <members>["user-1", "user-2", "user-3"]</members>
          </arguments>
        </tool_call>
      `;

      const result = parseXmlToolCall(xml);
      expect(result).toEqual({
        name: 'add_members',
        arguments: {
          members: ['user-1', 'user-2', 'user-3'],
        },
      });
    });

    it('should return null for invalid XML', () => {
      const xml = '<invalid>not a tool call</invalid>';
      const result = parseXmlToolCall(xml);
      expect(result).toBeNull();
    });

    it('should return null for XML without name', () => {
      const xml = `
        <tool_call>
          <arguments>
            <arg>value</arg>
          </arguments>
        </tool_call>
      `;
      const result = parseXmlToolCall(xml);
      expect(result).toBeNull();
    });

    it('should handle XML without arguments', () => {
      const xml = `
        <tool_call>
          <name>list_projects</name>
        </tool_call>
      `;

      const result = parseXmlToolCall(xml);
      expect(result).toEqual({
        name: 'list_projects',
        arguments: {},
      });
    });
  });

  describe('containsXmlToolCall', () => {
    it('should detect XML tool call in content', () => {
      const content = 'Here is some text <tool_call><name>test</name></tool_call> and more text';
      expect(containsXmlToolCall(content)).toBe(true);
    });

    it('should return false for content without XML tool call', () => {
      const content = 'This is just regular text without any tool calls';
      expect(containsXmlToolCall(content)).toBe(false);
    });
  });

  describe('extractAllXmlToolCalls', () => {
    it('should extract multiple XML tool calls', () => {
      const content = `
        First call:
        <tool_call>
          <name>tool_one</name>
          <arguments>
            <arg1>value1</arg1>
          </arguments>
        </tool_call>
        Second call:
        <tool_call>
          <name>tool_two</name>
          <arguments>
            <arg2>value2</arg2>
          </arguments>
        </tool_call>
      `;

      const result = extractAllXmlToolCalls(content);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('tool_one');
      expect(result[1].name).toBe('tool_two');
    });

    it('should return empty array for content without tool calls', () => {
      const content = 'No tool calls here';
      const result = extractAllXmlToolCalls(content);
      expect(result).toEqual([]);
    });
  });

  describe('stripXmlToolCalls', () => {
    it('should remove XML tool calls from content', () => {
      const content = `
        Here is some text
        <tool_call>
          <name>test</name>
        </tool_call>
        and more text after
      `;

      const result = stripXmlToolCalls(content);
      expect(result).not.toContain('<tool_call>');
      expect(result).toContain('Here is some text');
      expect(result).toContain('and more text after');
    });

    it('should handle content with no tool calls', () => {
      const content = 'Just regular text';
      const result = stripXmlToolCalls(content);
      expect(result).toBe('Just regular text');
    });
  });

  describe('xmlToolCallToOpenAI', () => {
    it('should convert XML tool call to OpenAI format', () => {
      const xmlToolCall = {
        name: 'create_project',
        arguments: {
          name: 'Test Project',
          userId: 'user-123',
        },
      };

      const result = xmlToolCallToOpenAI(xmlToolCall, 'test-id');
      expect(result).toEqual({
        id: 'test-id',
        type: 'function',
        function: {
          name: 'create_project',
          arguments: '{"name":"Test Project","userId":"user-123"}',
        },
      });
    });

    it('should generate ID if not provided', () => {
      const xmlToolCall = {
        name: 'list_projects',
        arguments: {},
      };

      const result = xmlToolCallToOpenAI(xmlToolCall);
      expect(result.id).toMatch(/^xml_/);
      expect(result.type).toBe('function');
      expect(result.function.name).toBe('list_projects');
    });
  });
});
