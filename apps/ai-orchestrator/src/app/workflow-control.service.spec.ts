import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowControlService, WorkflowType } from './workflow-control.service';
import { ConfigService } from '@nestjs/config';
import { ModelInitializerService } from './model-initializer.service';

describe('WorkflowControlService', () => {
  let service: WorkflowControlService;
  let modelInitializer: ModelInitializerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowControlService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ollama') {
                return { host: 'localhost', port: 11434 };
              }
              return null;
            }),
          },
        },
        {
          provide: ModelInitializerService,
          useValue: {
            getModelConfig: jest.fn((type: string) => {
              if (type === 'workflow_control') {
                return {
                  name: 'qwen2.5:3b',
                  temperature: 0.3,
                };
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<WorkflowControlService>(WorkflowControlService);
    modelInitializer = module.get<ModelInitializerService>(ModelInitializerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('heuristicDetection', () => {
    it('should detect conversational workflow for greetings', async () => {
      const result = await service.detectWorkflow('Hello, how are you?', []);
      expect(result.type).toBe(WorkflowType.CONVERSATIONAL);
      expect(result.requiresToolCalling).toBe(false);
      expect(result.requiresConversation).toBe(true);
    });

    it('should detect tool calling workflow for action requests', async () => {
      const result = await service.detectWorkflow('Create a project called Website Redesign', [
        'create_project',
      ]);
      expect(result.type).toBe(WorkflowType.TOOL_CALLING);
      expect(result.requiresToolCalling).toBe(true);
      expect(result.requiresConversation).toBe(false);
    });

    it('should detect hybrid workflow for combined requests', async () => {
      const result = await service.detectWorkflow(
        'List my projects and tell me which ones are most important',
        ['list_projects']
      );
      expect(result.type).toBe(WorkflowType.HYBRID);
      expect(result.requiresToolCalling).toBe(true);
      expect(result.requiresConversation).toBe(true);
    });

    it('should detect tool calling for update requests', async () => {
      const result = await service.detectWorkflow('Update task status to done', [
        'update_task',
      ]);
      expect(result.type).toBe(WorkflowType.TOOL_CALLING);
      expect(result.requiresToolCalling).toBe(true);
    });

    it('should detect conversational for explanation requests', async () => {
      const result = await service.detectWorkflow('Explain what TELOS means', []);
      expect(result.type).toBe(WorkflowType.CONVERSATIONAL);
      expect(result.requiresToolCalling).toBe(false);
      expect(result.requiresConversation).toBe(true);
    });

    it('should detect hybrid for show me requests', async () => {
      const result = await service.detectWorkflow('Show me my tasks', ['list_tasks']);
      expect(result.type).toBe(WorkflowType.HYBRID);
      expect(result.requiresToolCalling).toBe(true);
      expect(result.requiresConversation).toBe(true);
    });
  });

  describe('filterThinkingTokens', () => {
    it('should remove <think> tags from response', () => {
      const input = 'Here is my response <think>internal thoughts here</think> and more text';
      const result = service.filterThinkingTokens(input);
      expect(result).toBe('Here is my response  and more text');
      expect(result).not.toContain('<think>');
      expect(result).not.toContain('</think>');
    });

    it('should remove multiple thinking blocks', () => {
      const input =
        '<think>first thought</think>Response 1<think>second thought</think>Response 2';
      const result = service.filterThinkingTokens(input);
      expect(result).toBe('Response 1Response 2');
    });

    it('should remove [THINKING] markers', () => {
      const input = '[THINKING]Deep analysis here[/THINKING]The actual response';
      const result = service.filterThinkingTokens(input);
      expect(result).toBe('The actual response');
    });

    it('should remove **Thinking:** markers', () => {
      const input = '**Thinking:**\nInternal process\n\nActual response text';
      const result = service.filterThinkingTokens(input);
      expect(result).toBe('Actual response text');
    });

    it('should handle case-insensitive thinking tags', () => {
      const input = '<THINK>Uppercase thinking</THINK>Response text';
      const result = service.filterThinkingTokens(input);
      expect(result).toBe('Response text');
    });

    it('should clean up extra whitespace after removal', () => {
      const input = 'Line 1\n\n\n<think>thought</think>\n\n\nLine 2';
      const result = service.filterThinkingTokens(input);
      expect(result).toBe('Line 1\n\nLine 2');
    });

    it('should handle empty thinking blocks', () => {
      const input = 'Text before<think></think>Text after';
      const result = service.filterThinkingTokens(input);
      expect(result).toBe('Text beforeText after');
    });

    it('should return original text if no thinking tokens present', () => {
      const input = 'Normal response without thinking tokens';
      const result = service.filterThinkingTokens(input);
      expect(result).toBe('Normal response without thinking tokens');
    });
  });

  describe('parseWorkflowResponse', () => {
    it('should parse valid JSON workflow response', () => {
      const response = JSON.stringify({
        type: 'tool_calling',
        confidence: 0.9,
        reasoning: 'User wants to create something',
        requiresToolCalling: true,
        requiresConversation: false,
      });

      const result = (service as any).parseWorkflowResponse(response);
      expect(result.type).toBe(WorkflowType.TOOL_CALLING);
      expect(result.confidence).toBe(0.9);
      expect(result.requiresToolCalling).toBe(true);
    });

    it('should extract JSON from text response', () => {
      const response = `Based on the analysis, here is my decision:
        {
          "type": "hybrid",
          "confidence": 0.85,
          "reasoning": "Requires both actions",
          "requiresToolCalling": true,
          "requiresConversation": true
        }
        That's my assessment.`;

      const result = (service as any).parseWorkflowResponse(response);
      expect(result.type).toBe(WorkflowType.HYBRID);
      expect(result.confidence).toBe(0.85);
    });

    it('should fallback to text parsing for non-JSON responses', () => {
      const response = 'This clearly requires tool_calling to complete';
      const result = (service as any).parseWorkflowResponse(response);
      expect(result.type).toBe(WorkflowType.TOOL_CALLING);
    });

    it('should default to conversational for unparseable responses', () => {
      const response = 'Random text without clear indicators';
      const result = (service as any).parseWorkflowResponse(response);
      expect(result.type).toBe(WorkflowType.CONVERSATIONAL);
    });
  });
});
