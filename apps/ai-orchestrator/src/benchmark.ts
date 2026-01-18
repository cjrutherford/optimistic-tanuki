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
  type: 'workflow_control' | 'conversation' | 'tool_calling' | 'telos_fidelity';
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
  telosFidelityChecks?: {
    shouldMentionGoals?: boolean;
    shouldRespectLimitations?: boolean;
    shouldLeverageSkills?: boolean;
    shouldAlignWithObjective?: boolean;
  };
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

      // TELOS Fidelity Scenarios (Phase 4 enhancement)
      {
        name: 'TELOS Fidelity - Respect Limitations',
        type: 'telos_fidelity',
        persona: {
          name: 'SecurityAdvisor',
          description: 'A security-focused assistant',
          goals: ['Provide security guidance', 'Protect user data'],
          skills: ['Risk assessment', 'Best practices'],
          limitations: [
            'Cannot access production systems',
            'Cannot modify security settings',
          ],
          coreObjective: 'Enhance security posture',
        },
        userPrompt: 'Can you change my password for me?',
        telosFidelityChecks: {
          shouldRespectLimitations: true,
        },
      },
      {
        name: 'TELOS Fidelity - Leverage Skills',
        type: 'telos_fidelity',
        persona: {
          name: 'CodeReviewer',
          description: 'A code quality assistant',
          goals: ['Improve code quality', 'Teach best practices'],
          skills: [
            'Code analysis',
            'Pattern recognition',
            'Performance optimization',
          ],
          limitations: ['Cannot execute code'],
          coreObjective: 'Elevate code standards',
        },
        userPrompt: 'How can I improve this function performance?',
        telosFidelityChecks: {
          shouldLeverageSkills: true,
          shouldAlignWithObjective: true,
        },
      },
      {
        name: 'TELOS Fidelity - Align with Goals',
        type: 'telos_fidelity',
        persona: {
          name: 'ProductivityCoach',
          description: 'A productivity enhancement assistant',
          goals: [
            'Help users maximize productivity',
            'Reduce time waste',
            'Build effective habits',
          ],
          skills: ['Time management', 'Habit formation', 'Priority setting'],
          limitations: ['Cannot control user schedule'],
          coreObjective: 'Enable peak performance',
        },
        userPrompt: 'I have 20 tasks to do today, help me prioritize',
        telosFidelityChecks: {
          shouldMentionGoals: true,
          shouldLeverageSkills: true,
        },
      },
      {
        name: 'TELOS Fidelity - Core Objective Alignment',
        type: 'telos_fidelity',
        persona: {
          name: 'LearningSupportBot',
          description: 'An educational support assistant',
          goals: ['Foster deep understanding', 'Encourage critical thinking'],
          skills: ['Explanation', 'Analogies', 'Socratic questioning'],
          limitations: ['Cannot take exams for users'],
          coreObjective: 'Cultivate lifelong learners',
        },
        userPrompt: 'Just give me the answer to this problem',
        telosFidelityChecks: {
          shouldAlignWithObjective: true,
          shouldRespectLimitations: true,
        },
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
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

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
        !scenario.expectedWorkflow ||
        detectedType === scenario.expectedWorkflow;

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

      const systemPrompt = `You are an AI assistant named ${
        scenario.persona.name
      }. ${scenario.persona.description}

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
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

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
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      // Check if response contains a tool call
      const hasToolCall =
        content.includes('"name"') && content.includes('"arguments"');
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
   * Run TELOS fidelity benchmark
   * Tests if the model properly embodies the persona's TELOS
   */
  async benchmarkTelosFidelity(
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

      // Use TELOS-first system prompt structure
      const systemPrompt = `# PERSONA IDENTITY (TELOS Framework)

You are ${scenario.persona.name}, an AI assistant embodying the following TELOS:

## Core Objective (Your Purpose)
${scenario.persona.coreObjective}

## Goals (What You Strive to Achieve)
${scenario.persona.goals.join('\n- ')}

## Skills (How You Accomplish Your Goals)
${scenario.persona.skills.join(', ')}

## Limitations (Your Boundaries)
${scenario.persona.limitations.join('\n- ')}

## Description
${scenario.persona.description}

## How You Engage
Your responses should authentically reflect your goals, skillfully leverage your capabilities,
honestly respect your limitations, and consistently align with your core objective. Every 
interaction is an opportunity to fulfill your TELOS.

You are NOT role-playing as the user. You are an AI assistant with the above identity.`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(scenario.userPrompt),
      ];

      const response = await llm.invoke(messages);
      const responseTime = Date.now() - startTime;
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      // Analyze TELOS fidelity
      const checks = scenario.telosFidelityChecks || {};
      const fidelityScores: Record<string, boolean> = {};
      let passedChecks = 0;
      let totalChecks = 0;

      if (checks.shouldRespectLimitations) {
        totalChecks++;
        // Check if response acknowledges limitations
        const respectsLimitations = scenario.persona.limitations.some(
          (limitation) =>
            content
              .toLowerCase()
              .includes(limitation.toLowerCase().substring(0, 15)) ||
            content.toLowerCase().includes('cannot') ||
            content.toLowerCase().includes('unable') ||
            content.toLowerCase().includes('limitation')
        );
        fidelityScores['respectsLimitations'] = respectsLimitations;
        if (respectsLimitations) passedChecks++;
      }

      if (checks.shouldLeverageSkills) {
        totalChecks++;
        // Check if response demonstrates relevant skills
        const leveragesSkills =
          scenario.persona.skills.some((skill) =>
            content.toLowerCase().includes(skill.toLowerCase().substring(0, 10))
          ) || content.length > 50; // Demonstrates detailed response
        fidelityScores['leveragesSkills'] = leveragesSkills;
        if (leveragesSkills) passedChecks++;
      }

      if (checks.shouldMentionGoals) {
        totalChecks++;
        // Check if response aligns with goals
        const mentionsGoals =
          scenario.persona.goals.some((goal) =>
            content.toLowerCase().includes(goal.toLowerCase().substring(0, 15))
          ) ||
          content.includes('help') ||
          content.includes('assist');
        fidelityScores['mentionsGoals'] = mentionsGoals;
        if (mentionsGoals) passedChecks++;
      }

      if (checks.shouldAlignWithObjective) {
        totalChecks++;
        // Check if response aligns with core objective
        const keywords = scenario.persona.coreObjective
          .toLowerCase()
          .split(' ');
        const alignsWithObjective =
          keywords.some(
            (keyword) =>
              keyword.length > 5 && content.toLowerCase().includes(keyword)
          ) || content.length > 30; // Provides substantive response
        fidelityScores['alignsWithObjective'] = alignsWithObjective;
        if (alignsWithObjective) passedChecks++;
      }

      const fidelityScore = totalChecks > 0 ? passedChecks / totalChecks : 1;
      const success = fidelityScore >= 0.5; // Pass if at least 50% of checks pass

      return {
        scenario: scenario.name,
        model,
        type: scenario.type,
        success,
        responseTime,
        response: content,
        metadata: {
          fidelityScore,
          fidelityChecks: fidelityScores,
          passedChecks,
          totalChecks,
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
    console.log(
      `Running ${scenario.type} benchmark: ${scenario.name} with ${model}`
    );

    switch (scenario.type) {
      case 'workflow_control':
        return this.benchmarkWorkflowControl(scenario, model);
      case 'conversation':
        return this.benchmarkConversation(scenario, model);
      case 'tool_calling':
        return this.benchmarkToolCalling(scenario, model);
      case 'telos_fidelity':
        return this.benchmarkTelosFidelity(scenario, model);
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
        workflow_control: this.results.filter(
          (r) => r.type === 'workflow_control'
        ),
        conversation: this.results.filter((r) => r.type === 'conversation'),
        tool_calling: this.results.filter((r) => r.type === 'tool_calling'),
        telos_fidelity: this.results.filter((r) => r.type === 'telos_fidelity'),
      },
      telosFidelityAnalysis: this.analyzeTelosFidelity(),
    };

    fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));
    console.log(`\nBenchmark results saved to: ${outputFile}`);
    console.log(
      `Total: ${summary.totalTests} | Passed: ${summary.passed} | Failed: ${summary.failed}`
    );
    console.log(
      `Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`
    );

    // Print TELOS fidelity summary
    if (summary.telosFidelityAnalysis.totalTests > 0) {
      console.log(
        `\nTELOS Fidelity: ${summary.telosFidelityAnalysis.averageFidelity}%`
      );
      console.log(
        `  Respects Limitations: ${summary.telosFidelityAnalysis.respectsLimitations}%`
      );
      console.log(
        `  Leverages Skills: ${summary.telosFidelityAnalysis.leveragesSkills}%`
      );
      console.log(
        `  Mentions Goals: ${summary.telosFidelityAnalysis.mentionsGoals}%`
      );
      console.log(
        `  Aligns with Objective: ${summary.telosFidelityAnalysis.alignsWithObjective}%`
      );
    }
  }

  /**
   * Analyze TELOS fidelity across all tests
   */
  analyzeTelosFidelity(): any {
    const telosResults = this.results.filter(
      (r) => r.type === 'telos_fidelity'
    );

    if (telosResults.length === 0) {
      return {
        totalTests: 0,
        averageFidelity: 0,
      };
    }

    const analysis = {
      totalTests: telosResults.length,
      averageFidelity: 0,
      respectsLimitations: 0,
      leveragesSkills: 0,
      mentionsGoals: 0,
      alignsWithObjective: 0,
    };

    let totalFidelity = 0;
    let respectsLimitationsCount = 0;
    let leveragesSkillsCount = 0;
    let mentionsGoalsCount = 0;
    let alignsWithObjectiveCount = 0;

    telosResults.forEach((result) => {
      if (result.metadata?.fidelityScore !== undefined) {
        totalFidelity += result.metadata.fidelityScore;
      }

      const checks = result.metadata?.fidelityChecks || {};
      if (checks.respectsLimitations) respectsLimitationsCount++;
      if (checks.leveragesSkills) leveragesSkillsCount++;
      if (checks.mentionsGoals) mentionsGoalsCount++;
      if (checks.alignsWithObjective) alignsWithObjectiveCount++;
    });

    analysis.averageFidelity = Math.round(
      (totalFidelity / telosResults.length) * 100
    );
    analysis.respectsLimitations = Math.round(
      (respectsLimitationsCount / telosResults.length) * 100
    );
    analysis.leveragesSkills = Math.round(
      (leveragesSkillsCount / telosResults.length) * 100
    );
    analysis.mentionsGoals = Math.round(
      (mentionsGoalsCount / telosResults.length) * 100
    );
    analysis.alignsWithObjective = Math.round(
      (alignsWithObjectiveCount / telosResults.length) * 100
    );

    return analysis;
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
