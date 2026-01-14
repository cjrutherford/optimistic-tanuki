#!/usr/bin/env node
/**
 * AI Orchestrator Benchmark Script
 *
 * Tests workflow control, conversation, and tool calling capabilities
 * against models from the configured Ollama endpoint using real personas
 * and scenarios. Generates JSON benchmark results.
 *
 * Usage: node benchmark.js [--models model1,model2] [--output results.json]
 */

import { HttpClient } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkConfig {
  ollamaHost: string;
  ollamaPort: number;
  models?: string[];
  outputFile?: string;
}

interface BenchmarkScenario {
  name: string;
  type: 'workflow_control' | 'conversation' | 'tool_calling';
  persona: {
    name: string;
    description: string;
    goals: string[];
    skills: string[];
    limitations: string[];
    coreObjective: string;
  };
  userPrompt: string;
  expectedWorkflow?: 'conversational' | 'tool_calling' | 'hybrid';
  availableTools?: string[];
}

interface BenchmarkResult {
  scenario: string;
  model: string;
  type: string;
  success: boolean;
  responseTime: number;
  response: string;
  metadata?: any;
  error?: string;
}

class BenchmarkRunner {
  private config: BenchmarkConfig;
  private results: BenchmarkResult[] = [];

  constructor(config: BenchmarkConfig) {
    this.config = config;
  }

  /**
   * Fetch available models from Ollama
   */
  async fetchAvailableModels(): Promise<string[]> {
    try {
      const baseUrl = `http://${this.config.ollamaHost}:${this.config.ollamaPort}`;
      const response = await fetch(`${baseUrl}/api/tags`);
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      console.error('Failed to fetch models from Ollama:', error);
      return [];
    }
  }

  /**
   * Get benchmark scenarios
   */
  getScenarios(): BenchmarkScenario[] {
    return [
      // Workflow Control Scenarios
      {
        name: 'Simple Greeting - Conversational Detection',
        type: 'workflow_control',
        persona: {
          name: 'ProjectAssistant',
          description: 'A helpful project management assistant',
          goals: ['Help users manage projects efficiently'],
          skills: ['Task management', 'Communication'],
          limitations: ['Cannot access external systems'],
          coreObjective: 'Streamline project workflow',
        },
        userPrompt: 'Hello, how are you today?',
        expectedWorkflow: 'conversational',
        availableTools: ['create_project', 'list_tasks', 'query_projects'],
      },
      {
        name: 'Create Action - Tool Calling Detection',
        type: 'workflow_control',
        persona: {
          name: 'ProjectAssistant',
          description: 'A helpful project management assistant',
          goals: ['Help users manage projects efficiently'],
          skills: ['Task management', 'Communication'],
          limitations: ['Cannot access external systems'],
          coreObjective: 'Streamline project workflow',
        },
        userPrompt: 'Create a new project called Website Redesign',
        expectedWorkflow: 'tool_calling',
        availableTools: ['create_project', 'list_tasks', 'query_projects'],
      },
      {
        name: 'List and Explain - Hybrid Detection',
        type: 'workflow_control',
        persona: {
          name: 'ProjectAssistant',
          description: 'A helpful project management assistant',
          goals: ['Help users manage projects efficiently'],
          skills: ['Task management', 'Communication'],
          limitations: ['Cannot access external systems'],
          coreObjective: 'Streamline project workflow',
        },
        userPrompt: 'Show me my tasks and tell me which ones are urgent',
        expectedWorkflow: 'hybrid',
        availableTools: ['create_project', 'list_tasks', 'query_projects'],
      },

      // Conversational Scenarios
      {
        name: 'Explain Concept',
        type: 'conversation',
        persona: {
          name: 'TutorBot',
          description: 'An educational assistant specializing in explanations',
          goals: ['Provide clear explanations', 'Foster understanding'],
          skills: ['Teaching', 'Simplification', 'Examples'],
          limitations: ['No real-time data access'],
          coreObjective: 'Make complex topics accessible',
        },
        userPrompt: 'Explain what TELOS means in project management',
      },
      {
        name: 'Provide Guidance',
        type: 'conversation',
        persona: {
          name: 'CareerCoach',
          description: 'A career development mentor',
          goals: ['Help users advance their careers'],
          skills: ['Mentoring', 'Strategy', 'Communication'],
          limitations: ['Cannot guarantee job placement'],
          coreObjective: 'Empower career growth',
        },
        userPrompt: 'What skills should I focus on for project management?',
      },

      // Tool Calling Scenarios
      {
        name: 'Create Project with Details',
        type: 'tool_calling',
        persona: {
          name: 'ProjectAssistant',
          description: 'A helpful project management assistant',
          goals: ['Help users manage projects efficiently'],
          skills: ['Task management', 'Organization'],
          limitations: ['Cannot access external systems'],
          coreObjective: 'Streamline project workflow',
        },
        userPrompt:
          'Create a project called "Q1 Marketing Campaign" with planning status',
        availableTools: ['create_project', 'list_projects'],
      },
      {
        name: 'Query and List',
        type: 'tool_calling',
        persona: {
          name: 'DataAnalyst',
          description: 'A data-focused assistant',
          goals: ['Provide accurate data insights'],
          skills: ['Data retrieval', 'Analysis'],
          limitations: ['Read-only access'],
          coreObjective: 'Deliver actionable insights',
        },
        userPrompt: 'List all my projects',
        availableTools: ['list_projects', 'query_projects'],
      },
    ];
  }

  /**
   * Run workflow control benchmark
   */
  async benchmarkWorkflowControl(
    scenario: BenchmarkScenario,
    model: string
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const baseUrl = `http://${this.config.ollamaHost}:${this.config.ollamaPort}`;

    try {
      const llm = new ChatOllama({
        model,
        baseUrl,
        temperature: 0.3,
      });

      const toolsList = scenario.availableTools?.join(', ') || 'None';
      const systemPrompt = `You are a workflow classifier. Available tools: ${toolsList}

Classify the user's prompt as:
- "conversational" for general chat
- "tool_calling" for actions requiring tools
- "hybrid" for both

Respond with JSON: {"type": "...", "confidence": 0.0-1.0, "reasoning": "..."}`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(scenario.userPrompt),
      ];

      const response = await llm.invoke(messages);
      const responseTime = Date.now() - startTime;
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // Try to parse the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      let detectedType = 'unknown';
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          detectedType = parsed.type;
        } catch (e) {
          // Failed to parse
        }
      }

      const success =
        !scenario.expectedWorkflow || detectedType === scenario.expectedWorkflow;

      return {
        scenario: scenario.name,
        model,
        type: scenario.type,
        success,
        responseTime,
        response: content,
        metadata: {
          expectedWorkflow: scenario.expectedWorkflow,
          detectedWorkflow: detectedType,
        },
      };
    } catch (error: any) {
      return {
        scenario: scenario.name,
        model,
        type: scenario.type,
        success: false,
        responseTime: Date.now() - startTime,
        response: '',
        error: error.message,
      };
    }
  }

  /**
   * Run conversation benchmark
   */
  async benchmarkConversation(
    scenario: BenchmarkScenario,
    model: string
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const baseUrl = `http://${this.config.ollamaHost}:${this.config.ollamaPort}`;

    try {
      const llm = new ChatOllama({
        model,
        baseUrl,
        temperature: 0.7,
      });

      const systemPrompt = `You are an AI assistant named ${scenario.persona.name}. ${scenario.persona.description}

Goals: ${scenario.persona.goals.join(', ')}
Skills: ${scenario.persona.skills.join(', ')}
Core Objective: ${scenario.persona.coreObjective}

Provide a helpful, natural response to the user's question.`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(scenario.userPrompt),
      ];

      const response = await llm.invoke(messages);
      const responseTime = Date.now() - startTime;
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // Success if we got a response with reasonable length
      const success = content.length > 20 && content.length < 2000;

      return {
        scenario: scenario.name,
        model,
        type: scenario.type,
        success,
        responseTime,
        response: content,
        metadata: {
          responseLength: content.length,
        },
      };
    } catch (error: any) {
      return {
        scenario: scenario.name,
        model,
        type: scenario.type,
        success: false,
        responseTime: Date.now() - startTime,
        response: '',
        error: error.message,
      };
    }
  }

  /**
   * Run tool calling benchmark
   */
  async benchmarkToolCalling(
    scenario: BenchmarkScenario,
    model: string
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const baseUrl = `http://${this.config.ollamaHost}:${this.config.ollamaPort}`;

    try {
      const llm = new ChatOllama({
        model,
        baseUrl,
        temperature: 0.5,
      });

      const toolsList = scenario.availableTools?.join(', ') || 'None';
      const systemPrompt = `You are ${scenario.persona.name}. ${scenario.persona.description}

Available tools: ${toolsList}

When the user requests an action, respond with a JSON tool call in this format:
{"name": "tool_name", "arguments": {...}}

For example: {"name": "create_project", "arguments": {"name": "My Project", "userId": "user-123"}}`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(scenario.userPrompt),
      ];

      const response = await llm.invoke(messages);
      const responseTime = Date.now() - startTime;
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // Check if response contains a tool call
      const hasToolCall = content.includes('"name"') && content.includes('"arguments"');
      const success = hasToolCall;

      return {
        scenario: scenario.name,
        model,
        type: scenario.type,
        success,
        responseTime,
        response: content,
        metadata: {
          hasToolCall,
        },
      };
    } catch (error: any) {
      return {
        scenario: scenario.name,
        model,
        type: scenario.type,
        success: false,
        responseTime: Date.now() - startTime,
        response: '',
        error: error.message,
      };
    }
  }

  /**
   * Run benchmark for a specific scenario and model
   */
  async runBenchmark(
    scenario: BenchmarkScenario,
    model: string
  ): Promise<BenchmarkResult> {
    console.log(`Running ${scenario.type} benchmark: ${scenario.name} with ${model}`);

    switch (scenario.type) {
      case 'workflow_control':
        return this.benchmarkWorkflowControl(scenario, model);
      case 'conversation':
        return this.benchmarkConversation(scenario, model);
      case 'tool_calling':
        return this.benchmarkToolCalling(scenario, model);
      default:
        throw new Error(`Unknown scenario type: ${scenario.type}`);
    }
  }

  /**
   * Run all benchmarks
   */
  async runAll(): Promise<void> {
    const models = this.config.models || (await this.fetchAvailableModels());

    if (models.length === 0) {
      console.error('No models available for benchmarking');
      return;
    }

    console.log(`Running benchmarks with models: ${models.join(', ')}\n`);

    const scenarios = this.getScenarios();

    for (const scenario of scenarios) {
      for (const model of models) {
        const result = await this.runBenchmark(scenario, model);
        this.results.push(result);

        const status = result.success ? '✓ PASS' : '✗ FAIL';
        console.log(
          `${status} | ${scenario.name} | ${model} | ${result.responseTime}ms`
        );
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
      }
    }

    this.saveBenchmarkResults();
  }

  /**
   * Save benchmark results to JSON file
   */
  saveBenchmarkResults(): void {
    const outputFile =
      this.config.outputFile ||
      path.join(process.cwd(), 'benchmark-results.json');

    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      passed: this.results.filter((r) => r.success).length,
      failed: this.results.filter((r) => !r.success).length,
      averageResponseTime:
        this.results.reduce((sum, r) => sum + r.responseTime, 0) /
        this.results.length,
      results: this.results,
      byType: {
        workflow_control: this.results.filter((r) => r.type === 'workflow_control'),
        conversation: this.results.filter((r) => r.type === 'conversation'),
        tool_calling: this.results.filter((r) => r.type === 'tool_calling'),
      },
    };

    fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));
    console.log(`\nBenchmark results saved to: ${outputFile}`);
    console.log(`Total: ${summary.totalTests} | Passed: ${summary.passed} | Failed: ${summary.failed}`);
    console.log(`Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
  }
}

// Parse command line arguments
function parseArgs(): BenchmarkConfig {
  const args = process.argv.slice(2);
  const config: BenchmarkConfig = {
    ollamaHost: process.env.OLLAMA_HOST || 'localhost',
    ollamaPort: parseInt(process.env.OLLAMA_PORT || '11434'),
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--models' && args[i + 1]) {
      config.models = args[i + 1].split(',');
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      config.outputFile = args[i + 1];
      i++;
    } else if (args[i] === '--help') {
      console.log(`
AI Orchestrator Benchmark Script

Usage: node benchmark.js [options]

Options:
  --models <model1,model2>  Comma-separated list of models to test (default: all available)
  --output <file>           Output file for results (default: benchmark-results.json)
  --help                    Show this help message

Environment Variables:
  OLLAMA_HOST              Ollama server host (default: localhost)
  OLLAMA_PORT              Ollama server port (default: 11434)
      `);
      process.exit(0);
    }
  }

  return config;
}

// Main execution
async function main() {
  const config = parseArgs();
  const runner = new BenchmarkRunner(config);
  await runner.runAll();
}

main().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
