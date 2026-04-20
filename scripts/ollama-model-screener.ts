#!/usr/bin/env node
/**
 * Enhanced Ollama Model Screener & Fitness Analyzer
 *
 * Comprehensive benchmarking tool that tests models against real ai-orchestrator requirements.
 * Features: First message testing, multi-turn conversations, thought process tracking, context window detection.
 *
 * Usage: pnpm exec tsx scripts/ollama-model-screener.ts [options]
 */

import { ChatOllama } from '@langchain/ollama';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

declare const Chart: any;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface HardwareInfo {
  gpus: Array<{
    index: number;
    name: string;
    vramTotalMB: number;
    vramFreeMB: number;
  }>;
  ollamaHost: string;
  ollamaPort: number;
  cudaVisibleDevices?: string;
}

interface ModelInfo {
  name: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface VRAMEstimate {
  parameterSizeB: number;
  quantization: string;
  estimatedVRAMMB: number;
  contextOverheadMB: number;
  totalVRAMMB: number;
}

interface TokenMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputTokensPerSecond: number;
  outputTokensPerSecond: number;
  totalTokensPerSecond: number;
}

interface ThoughtProcessMetrics {
  thinkingStartTime: number;
  thinkingEndTime: number;
  thinkingDurationMs: number;
  thinkingTokens: number;
  responseTokens: number;
  hasThinkingBlock: boolean;
  thinkingBlockContent?: string;
}

interface DetailedBenchmarkResult {
  model: string;
  useCase: string;
  scenario: string;
  success: boolean;
  latencyMs: number;
  tokenMetrics: TokenMetrics;
  thoughtMetrics?: ThoughtProcessMetrics;
  responseLength: number;
  validationDetails: Record<string, any>;
  error?: string;
  timestamp: string;
  attemptNumber: number;
  selfCorrected: boolean;
  messageFlow?: MessageFlowEntry[];
}

interface MessageFlowEntry {
  step: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tokenCount: number;
  timestamp: string;
}

interface ModelFitnessReport {
  model: string;
  overallFitness: number;
  categoryScores: Record<string, number>;
  capabilityBreakdown: Record<string, boolean>;
  contextWindowSize?: number;
  bangForBuck: {
    score: number;
    vrEfficiency: number;
    performancePerGB: number;
  };
  recommendations: string[];
}

interface ScreenedModel extends ModelInfo, VRAMEstimate {
  fitScore: number;
  suitability: string[];
  fitnessReport?: ModelFitnessReport;
}

interface BenchmarkConfig {
  ollamaHost: string;
  ollamaPort: number;
  cudaVisibleDevices?: string;
  maxVRAMGB?: number;
  quantizations?: string[];
  families?: string[];
  excludeFamilies?: string[];
  benchmark?: boolean;
  output?: string;
  verbose?: boolean;
  debug?: boolean;
  enableSelfCorrection?: boolean;
  maxModels?: number;
  saveGraphs?: boolean;
  contextWindowTest?: boolean;
}

interface TelosPersona {
  name: string;
  description: string;
  goals: string[];
  skills: string[];
  interests: string[];
  limitations: string[];
  strengths: string[];
  objectives: string[];
  coreObjective: string;
  exampleResponses: string[];
}

interface TestSuite {
  name: string;
  description: string;
  scenarios: TestScenario[];
  weight: number;
}

interface TestScenario {
  name: string;
  useCase:
    | 'workflow_control'
    | 'tool_calling'
    | 'conversational'
    | 'self_correction'
    | 'safety'
    | 'first_message'
    | 'multi_turn';
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxAttempts?: number;
  requiresSelfCorrection?: boolean;
  isMultiTurn?: boolean;
  turns?: TurnConfig[];
  validate: (response: string | string[], context?: any) => ValidationResult;
  onError?: (error: string, attempt: number) => string | null;
}

interface TurnConfig {
  userMessage: string;
  expectedContext?: string[];
}

interface ValidationResult {
  success: boolean;
  score: number;
  details: Record<string, any>;
  retryable?: boolean;
  suggestion?: string;
  scoreExplanation?: string;
}

interface ContextWindowTestResult {
  model: string;
  maxContextSize: number;
  testPassed: boolean;
  details: string[];
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const QUANTIZATION_FACTORS: Record<string, number> = {
  Q4_K_M: 0.5,
  Q4_K_S: 0.45,
  Q5_K_M: 0.6,
  Q5_K_S: 0.55,
  Q6_K: 0.7,
  Q8_0: 1.0,
  FP16: 2.0,
  F16: 2.0,
  Q2_K: 0.35,
  Q3_K_M: 0.48,
  Q3_K_S: 0.42,
};

// Load TELOS personas
const PERSONAS: TelosPersona[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'personas-screener.json'), 'utf-8')
);

// Real MCP Tool Schemas from ai-orchestrator
const MCP_TOOL_SCHEMAS = {
  create_project: {
    name: 'create_project',
    description: 'Create a new project',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name [REQUIRED]' },
        description: {
          type: 'string',
          description: 'Project description [REQUIRED]',
        },
        status: {
          type: 'string',
          enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'],
          default: 'PLANNING',
        },
        userId: { type: 'string', description: 'User ID [REQUIRED]' },
      },
      required: ['name', 'description', 'userId'],
    },
  },
  create_task: {
    name: 'create_task',
    description: 'Create a new task in a project',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title [REQUIRED]' },
        description: { type: 'string', description: 'Task description' },
        projectId: {
          type: 'string',
          description: 'Project ID [REQUIRED - must query list_projects first]',
        },
        status: {
          type: 'string',
          enum: ['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED'],
          default: 'TODO',
        },
        priority: {
          type: 'string',
          enum: ['LOW', 'MEDIUM_LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'],
          default: 'MEDIUM',
        },
        userId: { type: 'string', description: 'User ID [REQUIRED]' },
      },
      required: ['title', 'projectId', 'userId'],
    },
  },
  list_projects: {
    name: 'list_projects',
    description: 'List all projects for a user',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID [REQUIRED]' },
      },
      required: ['userId'],
    },
  },
  delete_project: {
    name: 'delete_project',
    description: 'Delete a project permanently',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID to delete [REQUIRED]',
        },
      },
      required: ['projectId'],
    },
  },
  list_tools: {
    name: 'list_tools',
    description: 'Discover available tools and their schemas',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
};

// ANSI Color Codes
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

// ============================================================================
// TELOS PROMPT BUILDERS
// ============================================================================

function buildFirstMessagePrompt(persona: TelosPersona): string {
  return `# PERSONA IDENTITY (TELOS Framework)

You are ${
    persona.name
  }, an AI assistant embodying the following TELOS (purpose and nature):

## Core Objective (Your Purpose)
${persona.coreObjective}

## Goals (What You Strive to Achieve)
${persona.goals.join('\n')}

## Skills (How You Accomplish Your Goals)
${persona.skills.join(', ')}

## Limitations (Your Boundaries)
${persona.limitations.join('\n')}

## Description
${persona.description}

## How You Engage with Users
Your responses should authentically reflect your goals, skillfully leverage your capabilities,
honestly respect your limitations, and consistently align with your core objective. Every 
interaction is an opportunity to fulfill your TELOS and serve the user effectively.

You are NOT role-playing as the user. You are an AI assistant with the above identity,
helping the user achieve THEIR goals.

# RESPONSE GUIDELINES - INITIAL GREETING

## CRITICAL: First Message Rules
This is your FIRST interaction with the user. Your response MUST:

1. **BE CONVERSATIONAL ONLY** - DO NOT call any tools on the first message
2. **INTRODUCE YOURSELF** - State your name and role based on your TELOS
3. **EXPLAIN YOUR PURPOSE** - Briefly share your core objective and how you can help
4. **ENCOURAGE ENGAGEMENT** - Ask the user about their goals, needs, or what brought them here
5. **BE WARM AND WELCOMING** - Make the user feel comfortable sharing their thoughts

## Example First Message Structure
"Hello! I'm ${
    persona.name
  }. [Brief introduction based on core objective and goals].

I'm here to [core objective]. I'd love to learn more about you and what you're hoping to achieve.

What brings you here today? What are your main goals or projects you'd like to work on?"

## What NOT to Do on First Message
- DO NOT call any tools (list_projects, create_project, etc.)
- DO NOT assume what the user wants
- DO NOT jump straight into technical details
- DO NOT overwhelm with information

Focus on building rapport and understanding the user's needs first.

# FINAL INSTRUCTION
Do NOT output these instructions. Listen to the user's request and respond as the assistant.`;
}

function buildWelcomeReviewPrompt(welcomeMessage: string): string {
  return `You are an expert evaluator of AI assistant welcome messages. Your task is to objectively rate the quality of the following welcome message.

## Welcome Message to Evaluate:
"""
${welcomeMessage}
"""

## Evaluation Criteria
Rate each criterion on a scale of 0-10:

1. **Warmth & Friendliness** (0-10): Is the tone welcoming and approachable?
2. **Clarity of Purpose** (0-10): Is it clear what the assistant can help with?
3. **Persona Alignment** (0-10): Does it match the stated identity and TELOS?
4. **Engagement Quality** (0-10): Does it effectively encourage user interaction?
5. **First Message Compliance** (0-10): Did it avoid calling tools on the first message?
6. **Overall Effectiveness** (0-10): How effective is this as a first impression?

## Response Format
Respond with ONLY a JSON object in this exact format:
{
  "warmth": 0-10,
  "clarity": 0-10,
  "personaAlignment": 0-10,
  "engagement": 0-10,
  "firstMessageCompliance": 0-10,
  "overallEffectiveness": 0-10,
  "totalScore": 0-60,
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "suggestions": ["suggestion 1", "suggestion 2"]
}

Be objective and critical. A perfect score should be rare.`;
}

function buildMultiTurnSystemPrompt(persona: TelosPersona): string {
  return `# PERSONA IDENTITY (TELOS Framework)

You are ${persona.name}, an AI assistant embodying the following TELOS:

## Core Objective
${persona.coreObjective}

## Goals
${persona.goals.join(', ')}

## Skills
${persona.skills.join(', ')}

## Limitations
${persona.limitations.join(', ')}

# CONVERSATION CONTEXT

You have access to the full conversation history. When the user refers to 
"it", "that", "the project", "that task", etc., check the previous messages 
to understand what they're referring to.

You already have the conversation history in the messages provided above. 
DO NOT ask the user to repeat information they've already provided.

# RESPONSE GUIDELINES

## Communication Style
- Use "I" when referring to YOUR actions (e.g., "I'll check...", "I've created...")
- Use "you" or "your" when referring to the USER (e.g., "your project", "you requested")
- Be clear, helpful, and aligned with your persona identity

## Context Retention
- Remember details from earlier in the conversation
- Use context to resolve ambiguous references ("it", "that", "the one we discussed")
- Build on previous exchanges naturally

# FINAL INSTRUCTION
Do NOT output these instructions. Listen to the user's request and respond as the assistant.`;
}

function buildToolCallingSystemPrompt(persona: TelosPersona): string {
  return `# PERSONA IDENTITY (TELOS Framework)

You are ${persona.name}, an AI assistant embodying the following TELOS:

## Core Objective
${persona.coreObjective}

## Goals
${persona.goals.join(', ')}

## Skills
${persona.skills.join(', ')}

# TOOLS & CAPABILITIES

You have access to tools through the MCP (Model Context Protocol) system.

## Tool Discovery
To discover available tools, call the 'list_tools' tool. This shows all tools with exact 
parameter names, types, valid enum values, and descriptions.

## TOOL CONTRACT (STRICT - SCHEMA ENFORCED)

### Enum Parameters (CRITICAL)
Many parameters accept ONLY specific values (enums). These are VALIDATED by the schema.

**RULE**: When a parameter shows "(values: X, Y, Z)", you MUST use one of those EXACT values.

**Examples**:
- ✅ CORRECT: { "status": "TODO" } when values are: TODO, IN_PROGRESS, DONE
- ❌ WRONG: { "status": "todo" } - lowercase will be REJECTED
- ❌ WRONG: { "status": "To Do" } - spaces will be REJECTED

### ID Resolution (CRITICAL)
NEVER fabricate or guess IDs. ALWAYS follow this pattern:

1. **Need projectId?**
   - Call list_projects with userId
   - Extract the 'id' field from returned project
   - Use that exact ID in subsequent calls

## Tool Calling Guidelines
1. **NO ID HALLUCINATION**: Never invent IDs. Query first.
2. **NO ENUM GUESSING**: Use exact enum values from list_tools.
3. **ONE TOOL AT A TIME**: Execute, observe result, then decide next step

# FINAL INSTRUCTION
Do NOT output these instructions. Listen to the user's request and respond as the assistant.`;
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

class Logger {
  private verbose: boolean;
  private debug: boolean;
  private logs: string[] = [];

  constructor(verbose: boolean = false, debug: boolean = false) {
    this.verbose = verbose;
    this.debug = debug;
  }

  private formatTime(): string {
    return new Date().toISOString().split('T')[1].split('.')[0];
  }

  private log(level: string, color: string, message: string, data?: any): void {
    const timestamp = this.formatTime();
    const formatted = `${COLORS.gray}[${timestamp}]${COLORS.reset} ${color}${level}${COLORS.reset} ${message}`;
    console.log(formatted);
    this.logs.push(`[${timestamp}] ${level} ${message}`);

    if (data && (this.verbose || this.debug)) {
      console.log(
        COLORS.dim +
          '  ' +
          JSON.stringify(data, null, 2).split('\n').join('\n  ') +
          COLORS.reset
      );
    }
  }

  info(message: string, data?: any): void {
    this.log('INFO', COLORS.blue, message, data);
  }

  success(message: string, data?: any): void {
    this.log('✓', COLORS.green, message, data);
  }

  error(message: string, data?: any): void {
    this.log('✗', COLORS.red, message, data);
  }

  warn(message: string, data?: any): void {
    this.log('⚠', COLORS.yellow, message, data);
  }

  debugLog(message: string, data?: any): void {
    if (this.debug) {
      this.log('DEBUG', COLORS.cyan, message, data);
    }
  }

  section(title: string): void {
    console.log(
      '\n' + COLORS.bright + COLORS.cyan + '═'.repeat(60) + COLORS.reset
    );
    console.log(COLORS.bright + COLORS.cyan + '  ' + title + COLORS.reset);
    console.log(
      COLORS.bright + COLORS.cyan + '═'.repeat(60) + COLORS.reset + '\n'
    );
    this.logs.push(`\n=== ${title} ===\n`);
  }

  progress(current: number, total: number, message: string): void {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * 20);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    process.stdout.write(
      `\r${COLORS.cyan}[${bar}]${COLORS.reset} ${percentage}% ${message}`
    );
    if (current === total) process.stdout.write('\n');
  }

  logMessageFlow(flow: MessageFlowEntry[]): void {
    if (!this.debug) return;

    console.log('\n' + COLORS.bright + 'Message Flow:' + COLORS.reset);
    console.log('─'.repeat(80));
    for (const entry of flow) {
      const color =
        entry.role === 'system'
          ? COLORS.gray
          : entry.role === 'user'
          ? COLORS.blue
          : entry.role === 'assistant'
          ? COLORS.green
          : COLORS.yellow;
      console.log(
        `${color}[${entry.role.toUpperCase()}]${COLORS.reset} (${
          entry.tokenCount
        } tokens) ${entry.timestamp}`
      );
      console.log(
        COLORS.dim +
          entry.content.substring(0, 200) +
          (entry.content.length > 200 ? '...' : '') +
          COLORS.reset
      );
    }
    console.log('─'.repeat(80));
  }

  saveLogs(outputPath: string): void {
    const logPath = outputPath.replace('.json', '.log');
    fs.writeFileSync(logPath, this.logs.join('\n'));
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

// Get Patricia P. Project for tool calling tests
const PATRICIA =
  PERSONAS.find((p) => p.name === 'Patricia P. Project') || PERSONAS[1];
const ALEX = PERSONAS.find((p) => p.name === 'Alex Generalis') || PERSONAS[0];

const TEST_SUITES: TestSuite[] = [
  {
    name: 'First Message & Welcome',
    description:
      'Tests TELOS-driven welcome messages and first interaction behavior',
    weight: 0.1,
    scenarios: [
      {
        name: 'Welcome Message Generation - Patricia',
        useCase: 'first_message',
        systemPrompt: buildFirstMessagePrompt(PATRICIA),
        userPrompt: 'Hello',
        temperature: 0.7,
        validate: (response: any) => {
          const lower = response.toLowerCase();

          // Check key requirements
          const introducesSelf =
            lower.includes('patricia') || lower.includes('project manager');
          const noToolCalls =
            !response.includes('"name":') &&
            !response.includes('list_projects') &&
            !response.includes('create_project');
          const explainsPurpose =
            lower.includes('project') &&
            (lower.includes('help') ||
              lower.includes('manage') ||
              lower.includes('assist'));
          const asksEngagement =
            response.includes('?') &&
            (lower.includes('what') ||
              lower.includes('how') ||
              lower.includes('goal') ||
              lower.includes('project'));
          const warmTone = response.length > 100 && response.length < 800;

          const score =
            (introducesSelf ? 20 : 0) +
            (noToolCalls ? 20 : 0) +
            (explainsPurpose ? 20 : 0) +
            (asksEngagement ? 20 : 0) +
            (warmTone ? 20 : 0);

          return {
            success: score >= 80,
            score,
            details: {
              introducesSelf,
              noToolCalls,
              explainsPurpose,
              asksEngagement,
              warmTone,
              responsePreview: response.substring(0, 150),
            },
          };
        },
      },
      {
        name: 'Welcome Message Generation - Alex',
        useCase: 'first_message',
        systemPrompt: buildFirstMessagePrompt(ALEX),
        userPrompt: 'Hi there!',
        temperature: 0.7,
        validate: (response: any) => {
          const lower = response.toLowerCase();

          const introducesSelf =
            lower.includes('alex') || lower.includes('general');
          const noToolCalls = !response.includes('"name":');
          const explainsPurpose =
            lower.includes('help') || lower.includes('assist');
          const asksEngagement = response.includes('?');
          const warmTone = response.length > 80 && response.length < 600;

          const score =
            (introducesSelf ? 20 : 0) +
            (noToolCalls ? 20 : 0) +
            (explainsPurpose ? 20 : 0) +
            (asksEngagement ? 20 : 0) +
            (warmTone ? 20 : 0);

          return {
            success: score >= 80,
            score,
            details: {
              introducesSelf,
              noToolCalls,
              explainsPurpose,
              asksEngagement,
              warmTone,
              responsePreview: response.substring(0, 150),
              scoreExplanation: `Score ${score}/100: ${
                introducesSelf
                  ? '+20 (self-introduction)'
                  : '-20 (no self-introduction)'
              } ${
                noToolCalls
                  ? '+20 (no tool calls)'
                  : '-20 (called tools prematurely)'
              } ${
                explainsPurpose
                  ? '+20 (explains purpose)'
                  : '-20 (unclear purpose)'
              } ${
                asksEngagement
                  ? '+20 (asks engagement question)'
                  : '-20 (no engagement question)'
              } ${warmTone ? '+20 (warm tone)' : '-20 (tone issues)'}`,
            },
          };
        },
      },
      {
        name: 'Welcome Message Self-Evaluation',
        useCase: 'first_message',
        systemPrompt: `You are ${
          PATRICIA.name
        }, an AI assistant embodying the following TELOS:

## Core Objective
${PATRICIA.coreObjective}

## Goals
${PATRICIA.goals.join(', ')}

## Skills
${PATRICIA.skills.join(', ')}

## Strengths
${PATRICIA.strengths.join(', ')}

## Limitations
${PATRICIA.limitations.join(', ')}

## Your Task
Generate a welcome message for a new user who just said "Hello". 
Your welcome message should:
1. Introduce yourself by name and role
2. Explain what you can help with (projects, tasks, tracking)
3. Ask an engaging question to encourage the user
4. NOT call any tools or functions on the first message
5. Be warm, professional, and concise (under 500 characters)

After generating your welcome message, you will evaluate it objectively.`,
        userPrompt: `First, generate your welcome message.
Then, evaluate your own message using these criteria (rate 0-10 each):
1. Warmth & Friendliness
2. Clarity of Purpose
3. Persona Alignment (does it reflect your TELOS?)
4. Engagement Quality
5. First Message Compliance (no tools called)
6. Overall Effectiveness

Provide your response in this JSON format:
{
  "welcomeMessage": "your generated welcome message here",
  "evaluation": {
    "warmth": 0-10,
    "clarity": 0-10,
    "persona": 0-10,
    "engagement": 0-10,
    "compliance": 0-10,
    "overall": 0-10,
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1", "weakness 2"]
  }
}`,
        temperature: 0.4,
        validate: (response: any) => {
          const responseStr = Array.isArray(response)
            ? response[response.length - 1]
            : response;

          const welcomeMatch =
            responseStr.match(/"welcomeMessage"?:\s*"([\s\S]*?)"/) ||
            responseStr.match(
              /welcomeMessage["']?\s*[:=]\s*["']([\s\S]*?)["']/
            ) ||
            responseStr.match(/["'](Hi|Hello|Welcome)[\s\S]*?["']/);
          const welcomeMessage = welcomeMatch
            ? welcomeMatch[1] || welcomeMatch[0]
            : '';

          const warmthMatch = responseStr.match(/"warmth"?:\s*(\d+)/i);
          const clarityMatch = responseStr.match(/"clarity"?:\s*(\d+)/i);
          const personaMatch = responseStr.match(/"persona"?:\s*(\d+)/i);
          const engagementMatch = responseStr.match(/"engagement"?:\s*(\d+)/i);
          const complianceMatch = responseStr.match(/"compliance"?:\s*(\d+)/i);
          const overallMatch = responseStr.match(/"overall"?:\s*(\d+)/i);

          const warmth = warmthMatch ? parseInt(warmthMatch[1]) : -1;
          const clarity = clarityMatch ? parseInt(clarityMatch[1]) : -1;
          const persona = personaMatch ? parseInt(personaMatch[1]) : -1;
          const engagement = engagementMatch
            ? parseInt(engagementMatch[1])
            : -1;
          const compliance = complianceMatch
            ? parseInt(complianceMatch[1])
            : -1;
          const overall = overallMatch ? parseInt(overallMatch[1]) : -1;

          const hasAllScores =
            warmth >= 0 &&
            clarity >= 0 &&
            persona >= 0 &&
            engagement >= 0 &&
            compliance >= 0 &&
            overall >= 0;
          const validScores =
            hasAllScores &&
            warmth <= 10 &&
            clarity <= 10 &&
            persona <= 10 &&
            engagement <= 10 &&
            compliance <= 10 &&
            overall <= 10;

          let score = 0;
          let breakdown = '';

          if (validScores) {
            const calculatedTotal =
              warmth + clarity + persona + engagement + compliance + overall;
            score = Math.min(100, Math.round((calculatedTotal / 60) * 100));
            breakdown = `warmth=${warmth}, clarity=${clarity}, persona=${persona}, engagement=${engagement}, compliance=${compliance}, overall=${overall}`;
          } else if (hasAllScores && warmth <= 60) {
            const totalFromIndividual =
              warmth + clarity + persona + engagement + compliance + overall;
            score = Math.min(100, Math.round((totalFromIndividual / 60) * 100));
            breakdown = `totalFromIndividual=${totalFromIndividual}`;
          } else {
            const totalMatch =
              responseStr.match(/"totalScore"?:\s*(\d+)/i) ||
              responseStr.match(/total.*?(\d+)/i) ||
              responseStr.match(/score.*?(\d+)/i);
            const extractedTotal = totalMatch ? parseInt(totalMatch[1]) : 0;
            if (extractedTotal > 0 && extractedTotal <= 60) {
              score = Math.min(100, Math.round((extractedTotal / 60) * 100));
              breakdown = `extractedTotal=${extractedTotal}`;
            } else {
              score = hasAllScores ? 50 : 0;
              breakdown = hasAllScores
                ? 'scores provided but invalid format'
                : 'no valid evaluation found';
            }
          }

          return {
            success: score >= 50,
            score,
            details: {
              welcomeMessage: welcomeMessage?.substring(0, 200) || 'Not found',
              warmth,
              clarity,
              persona,
              engagement,
              compliance,
              overall,
              validScores,
              breakdown,
              responsePreview: responseStr.substring(0, 400),
              scoreExplanation: `Score ${score}/100: ${
                validScores
                  ? '+' + (score - 50) + ' (detailed: ' + breakdown + ')'
                  : '+' + (score - 50) + ' (' + breakdown + ')'
              } - ${score >= 50 ? 'PASS' : 'FAIL'}${
                !validScores && !hasAllScores
                  ? '. Model response: ' + responseStr.substring(0, 200)
                  : ''
              }`,
            },
          };
        },
      },
    ],
  },
  {
    name: 'Multi-Turn Context Retention',
    description:
      'Tests conversation memory and context preservation across multiple turns',
    weight: 0.15,
    scenarios: [
      {
        name: 'Project Reference Memory (3 turns)',
        useCase: 'multi_turn',
        systemPrompt: buildMultiTurnSystemPrompt(PATRICIA),
        userPrompt: 'Create a project called "Website Redesign"',
        temperature: 0.7,
        isMultiTurn: true,
        turns: [
          {
            userMessage: 'Create a project called "Website Redesign"',
            expectedContext: ['Website Redesign'],
          },
          {
            userMessage: 'Add a task to it called "Review design mockups"',
            expectedContext: ['Website Redesign'],
          },
          {
            userMessage: 'What is the status of that project?',
            expectedContext: ['Website Redesign'],
          },
        ],
        validate: (responses: any, context?: any) => {
          const turns = context?.turns || [
            { expectedContext: ['Website Redesign'] },
            { expectedContext: ['Website Redesign'] },
            { expectedContext: ['Website Redesign'] },
          ];

          const turn2Ctx = turns[1]?.expectedContext || ['Website Redesign'];
          const turn3Ctx = turns[2]?.expectedContext || ['Website Redesign'];

          const turn2Response = (responses[1] || '').toLowerCase();
          const turn3Response = (responses[2] || '').toLowerCase();

          let turn2Matches = 0;
          let turn3Matches = 0;

          for (const term of turn2Ctx) {
            if (term && turn2Response.includes(term.toLowerCase())) {
              turn2Matches++;
            }
          }

          for (const term of turn3Ctx) {
            if (term && turn3Response.includes(term.toLowerCase())) {
              turn3Matches++;
            }
          }

          const turn2Score =
            turn2Ctx.length > 0
              ? Math.min(50, Math.round((turn2Matches / turn2Ctx.length) * 50))
              : 50;
          const turn3Score =
            turn3Ctx.length > 0
              ? Math.min(50, Math.round((turn3Matches / turn3Ctx.length) * 50))
              : 50;

          const score = turn2Score + turn3Score;

          return {
            success: score >= 80,
            score,
            details: {
              turnCount: responses.length,
              turn2Matches,
              turn2Expected: turn2Ctx,
              turn2Actual: turn2Response.substring(0, 100),
              turn3Matches,
              turn3Expected: turn3Ctx,
              turn3Actual: turn3Response.substring(0, 100),
              responses: responses.map(
                (r: string) => r?.substring(0, 100) || ''
              ),
              scoreExplanation: `Score ${score}/100: turn2=${turn2Score}/50 (matched ${turn2Matches}/${
                turn2Ctx.length
              }: ${turn2Ctx.join(
                ', '
              )}), turn3=${turn3Score}/50 (matched ${turn3Matches}/${
                turn3Ctx.length
              }: ${turn3Ctx.join(', ')}). ${
                score < 80
                  ? 'FAIL. Actual responses: ' +
                    responses
                      .map(
                        (r: string) => '"' + (r || '').substring(0, 80) + '"'
                      )
                      .join(' | ')
                  : 'PASS'
              }`,
            },
          };
        },
      },
      {
        name: 'Task Creation Context (4 turns)',
        useCase: 'multi_turn',
        systemPrompt: buildMultiTurnSystemPrompt(PATRICIA),
        userPrompt: 'I need to create a task',
        temperature: 0.7,
        isMultiTurn: true,
        turns: [
          { userMessage: 'I need to create a task', expectedContext: [] },
          {
            userMessage: 'It should be called "Fix login bug"',
            expectedContext: ['Fix login bug'],
          },
          {
            userMessage: 'Make it high priority',
            expectedContext: ['Fix login bug', 'high'],
          },
          {
            userMessage: 'What did we just create?',
            expectedContext: ['Fix login bug', 'high priority'],
          },
        ],
        validate: (responses: any, context?: any) => {
          const turns = context?.turns || [
            { expectedContext: [] },
            { expectedContext: ['Fix login bug'] },
            { expectedContext: ['Fix login bug', 'high'] },
            { expectedContext: ['Fix login bug', 'high priority'] },
          ];

          const finalCtx = turns[3]?.expectedContext || [
            'Fix login bug',
            'high priority',
          ];
          const finalResponse = (responses[3] || '').toLowerCase();

          let matches = 0;
          for (const term of finalCtx) {
            if (term && finalResponse.includes(term.toLowerCase())) {
              matches++;
            }
          }

          const score =
            finalCtx.length > 0
              ? Math.min(100, Math.round((matches / finalCtx.length) * 100))
              : 100;

          return {
            success: score >= 80,
            score,
            details: {
              turnCount: responses.length,
              matches,
              expected: finalCtx,
              actual: finalResponse.substring(0, 150),
              allResponses: responses.map(
                (r: string) => r?.substring(0, 100) || ''
              ),
              scoreExplanation: `Score ${score}/100: matched ${matches}/${
                finalCtx.length
              } expected context terms: [${finalCtx.join(', ')}]. ${
                score < 80
                  ? 'FAIL. Actual final response: "' +
                    (responses[3] || 'EMPTY').substring(0, 150) +
                    '" | All responses: ' +
                    responses
                      .map(
                        (r: string, i: number) =>
                          'T' +
                          (i + 1) +
                          '="' +
                          (r || '').substring(0, 50) +
                          '"'
                      )
                      .join(' | ')
                  : 'PASS'
              }`,
            },
          };
        },
      },
      {
        name: 'Complex Multi-Reference (5 turns)',
        useCase: 'multi_turn',
        systemPrompt: buildMultiTurnSystemPrompt(PATRICIA),
        userPrompt: 'Let me tell you about my projects',
        temperature: 0.7,
        isMultiTurn: true,
        turns: [
          {
            userMessage: 'Let me tell you about my projects',
            expectedContext: [],
          },
          {
            userMessage: 'I have Alpha and Beta projects',
            expectedContext: ['Alpha', 'Beta'],
          },
          {
            userMessage: 'Alpha is for the website',
            expectedContext: ['Alpha', 'website'],
          },
          {
            userMessage: 'Beta is for the mobile app',
            expectedContext: ['Beta', 'mobile app'],
          },
          {
            userMessage: 'Which one should I focus on first?',
            expectedContext: ['Alpha', 'Beta', 'website', 'mobile'],
          },
        ],
        validate: (responses: any, context?: any) => {
          const turns = context?.turns || [
            { expectedContext: [] },
            { expectedContext: ['Alpha', 'Beta'] },
            { expectedContext: ['Alpha', 'website'] },
            { expectedContext: ['Beta', 'mobile app'] },
            { expectedContext: ['Alpha', 'Beta', 'website', 'mobile'] },
          ];

          const finalCtx = turns[4]?.expectedContext || [
            'Alpha',
            'Beta',
            'website',
            'mobile',
          ];
          const finalResponse = (responses[4] || '').toLowerCase();

          let matches = 0;
          for (const term of finalCtx) {
            if (term && finalResponse.includes(term.toLowerCase())) {
              matches++;
            }
          }

          const score = Math.min(
            100,
            Math.round((matches / finalCtx.length) * 100)
          );

          return {
            success: score >= 70,
            score,
            details: {
              matches,
              expected: finalCtx,
              actual: finalResponse.substring(0, 200),
              allResponses: responses.map(
                (r: string) => r?.substring(0, 100) || ''
              ),
              scoreExplanation: `Score ${score}/100: matched ${matches}/${
                finalCtx.length
              } expected terms: [${finalCtx.join(', ')}]. ${
                score < 70
                  ? 'FAIL. Final response: "' +
                    (responses[4] || 'EMPTY').substring(0, 200) +
                    '" | All: ' +
                    responses
                      .map(
                        (r: string, i: number) =>
                          'T' +
                          (i + 1) +
                          '="' +
                          (r || '').substring(0, 40) +
                          '"'
                      )
                      .join(' | ')
                  : 'PASS'
              }`,
            },
          };
        },
      },
    ],
  },
];

// Add remaining test suites (Workflow Detection, Tool Call Construction, etc.)
// ... [Previous test suites from original file] ...

// ============================================================================
// SCORE EXPLANATION HELPER
// ============================================================================

function generateScoreExplanation(
  score: number,
  details: Record<string, any>
): string {
  const scoreStr = `${score}/100`;
  const status = score >= 80 ? 'PASS' : score >= 50 ? 'PARTIAL' : 'FAIL';

  const factors: string[] = [];

  if (details.introducesSelf !== undefined) {
    factors.push(
      details.introducesSelf
        ? '+20 (self-introduction)'
        : '-20 (no self-introduction)'
    );
  }
  if (details.noToolCalls !== undefined) {
    factors.push(
      details.noToolCalls
        ? '+20 (no premature tool calls)'
        : '-20 (premature tool calls)'
    );
  }
  if (details.explainsPurpose !== undefined) {
    factors.push(
      details.explainsPurpose
        ? '+20 (explains purpose)'
        : '-20 (unclear purpose)'
    );
  }
  if (details.asksEngagement !== undefined) {
    factors.push(
      details.asksEngagement
        ? '+20 (asks engagement question)'
        : '-20 (no engagement question)'
    );
  }
  if (details.warmTone !== undefined) {
    factors.push(details.warmTone ? '+20 (warm tone)' : '-20 (tone issues)');
  }
  if (details.turn2MaintainsContext !== undefined) {
    factors.push(
      details.turn2MaintainsContext
        ? '+50 (context turn 2)'
        : '-50 (lost context turn 2)'
    );
  }
  if (details.turn3MaintainsContext !== undefined) {
    factors.push(
      details.turn3MaintainsContext
        ? '+50 (context turn 3)'
        : '-50 (lost context turn 3)'
    );
  }
  if (details.hasSelfEvaluation !== undefined) {
    factors.push(
      details.hasSelfEvaluation
        ? '+50 (self-evaluation)'
        : '-50 (no self-evaluation)'
    );
  }
  if (details.extractedScore > 0) {
    factors.push(
      `+${details.extractedScore / 2} (self-rated: ${
        details.extractedScore
      }/60)`
    );
  }

  const factorsStr = factors.length > 0 ? ' ' + factors.join(' ') : '';
  return `Score ${scoreStr}: ${status}${factorsStr}`;
}

// ============================================================================
// THOUGHT PROCESS EXTRACTION
// ============================================================================

function extractThinkingBlock(content: string): {
  thinking: string;
  response: string;
  hasThinking: boolean;
} {
  // Pattern 1: <think>...</think>
  let match = content.match(/<think>([\s\S]*?)<\/think>/);
  if (match) {
    return {
      thinking: match[1].trim(),
      response: content.replace(/<think>[\s\S]*?<\/think>/, '').trim(),
      hasThinking: true,
    };
  }

  // Pattern 2: <output>...</output> (DeepSeek)
  match = content.match(/<output>([\s\S]*?)<\/output>/);
  if (match) {
    return {
      thinking: match[1].trim(),
      response: content.replace(/<output>[\s\S]*?<\/output>/, '').trim(),
      hasThinking: true,
    };
  }

  // Pattern 3: [THINKING]...[/THINKING]
  match = content.match(/\[THINKING\]([\s\S]*?)\[\/THINKING\]/);
  if (match) {
    return {
      thinking: match[1].trim(),
      response: content
        .replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/, '')
        .trim(),
      hasThinking: true,
    };
  }

  // Pattern 4: **Thinking:**...
  match = content.match(/\*\*Thinking:\*\*([\s\S]*?)(?=\*\*|\n\n|$)/);
  if (match) {
    return {
      thinking: match[1].trim(),
      response: content
        .replace(/\*\*Thinking:\*\*[\s\S]*?(?=\*\*|\n\n|$)/, '')
        .trim(),
      hasThinking: true,
    };
  }

  return { thinking: '', response: content, hasThinking: false };
}

// ============================================================================
// CONTEXT WINDOW DETECTION
// ============================================================================

async function detectContextWindow(
  modelName: string,
  hardware: HardwareInfo,
  logger: Logger
): Promise<ContextWindowTestResult> {
  logger.info(`Testing context window size for ${modelName}...`);

  const baseUrl = `http://${hardware.ollamaHost}:${hardware.ollamaPort}`;
  const testSizes = [4096, 8192, 16384, 32768, 65536, 131072];
  let maxWorkingSize = 0;
  const details: string[] = [];

  for (const size of testSizes) {
    try {
      // Create a prompt with approximately 'size' tokens
      const tokenEstimate = Math.floor(size * 0.75); // ~0.75 chars per token
      const fillerText = 'Context testing. '.repeat(
        Math.ceil(tokenEstimate / 17)
      );
      const prompt =
        fillerText.substring(0, tokenEstimate) +
        '\n\nBased on the context above, what is the main topic? Reply with one word: Testing';

      const llm = new ChatOllama({
        model: modelName,
        baseUrl,
        temperature: 0.1,
      });

      const startTime = Date.now();
      const response = await llm.invoke([new HumanMessage(prompt)]);
      const latency = Date.now() - startTime;

      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      if (
        content.toLowerCase().includes('test') ||
        content.toLowerCase().includes('testing')
      ) {
        maxWorkingSize = size;
        details.push(`✓ ${size} tokens: SUCCESS (${latency}ms)`);
        logger.debugLog(`Context window ${size}: SUCCESS`);
      } else {
        details.push(`✗ ${size} tokens: Incorrect response`);
        logger.debugLog(
          `Context window ${size}: Incorrect response - "${content.substring(
            0,
            50
          )}"`
        );
        break;
      }
    } catch (error: any) {
      details.push(`✗ ${size} tokens: ${error.message}`);
      logger.debugLog(`Context window ${size}: ERROR - ${error.message}`);
      break;
    }
  }

  return {
    model: modelName,
    maxContextSize: maxWorkingSize,
    testPassed: maxWorkingSize > 0,
    details,
  };
}

// ============================================================================
// HARDWARE & MODEL DETECTION
// ============================================================================

async function detectHardware(): Promise<HardwareInfo> {
  const ollamaHost = process.env.OLLAMA_HOST || 'localhost';
  const ollamaPort = parseInt(process.env.OLLAMA_PORT || '11434');
  const cudaVisibleDevices = process.env.CUDA_VISIBLE_DEVICES;

  const gpus: HardwareInfo['gpus'] = [];

  return new Promise((resolve) => {
    const nvidiaSmi = spawn('nvidia-smi', [
      '--query-gpu=index,name,memory.total,memory.free',
      '--format=csv,noheader,nounits',
    ]);

    let stdout = '';
    let stderr = '';

    nvidiaSmi.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    nvidiaSmi.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    nvidiaSmi.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          const parts = line.split(',').map((s) => s.trim());
          if (parts.length >= 4) {
            gpus.push({
              index: parseInt(parts[0]),
              name: parts[1],
              vramTotalMB: parseInt(parts[2]),
              vramFreeMB: parseInt(parts[3]),
            });
          }
        }
      }

      resolve({
        gpus,
        ollamaHost,
        ollamaPort,
        cudaVisibleDevices,
      });
    });

    nvidiaSmi.on('error', () => {
      resolve({
        gpus: [],
        ollamaHost,
        ollamaPort,
        cudaVisibleDevices,
      });
    });
  });
}

async function fetchAvailableModels(
  host: string,
  port: number
): Promise<ModelInfo[]> {
  try {
    const baseUrl = `http://${host}:${port}`;
    const response = await fetch(`${baseUrl}/api/tags`);
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Failed to fetch models from Ollama:', error);
    return [];
  }
}

function parseParameterSize(sizeStr: string): number {
  if (!sizeStr) return 0;
  const match = sizeStr.toUpperCase().match(/([\d.]+)([BMK])/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2];
  if (unit === 'K') return value * 1000;
  if (unit === 'M') return value * 1000000;
  if (unit === 'B') return value * 1000000000;
  return value;
}

function parseQuantization(tag: string): string {
  const quantPatterns = [
    'Q4_K_M',
    'Q4_K_S',
    'Q5_K_M',
    'Q5_K_S',
    'Q6_K',
    'Q8_0',
    'FP16',
    'F16',
    'Q2_K',
    'Q3_K_M',
    'Q3_K_S',
  ];
  for (const q of quantPatterns) {
    if (tag.toUpperCase().includes(q)) return q;
  }
  return 'UNKNOWN';
}

function estimateVRAM(model: ModelInfo): VRAMEstimate {
  const paramSizeStr = model.details?.parameter_size || '';
  const paramSizeB = parseParameterSize(paramSizeStr);
  const quantization = parseQuantization(model.name);
  const factor = QUANTIZATION_FACTORS[quantization] || 0.5;

  const weightsMB = (paramSizeB * factor) / (1024 * 1024);
  const contextOverheadMB = 256;
  const backendOverheadMB = 512;

  return {
    parameterSizeB: paramSizeB,
    quantization,
    estimatedVRAMMB: Math.ceil(weightsMB),
    contextOverheadMB,
    totalVRAMMB: Math.ceil(weightsMB + contextOverheadMB + backendOverheadMB),
  };
}

// ============================================================================
// TOKEN COUNTING & METRICS
// ============================================================================

function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token on average
  return Math.ceil(text.length / 4);
}

function calculateTokenMetrics(
  inputText: string,
  outputText: string,
  latencyMs: number
): TokenMetrics {
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  const totalTokens = inputTokens + outputTokens;

  const seconds = latencyMs / 1000;
  const inputTokensPerSecond = seconds > 0 ? inputTokens / seconds : 0;
  const outputTokensPerSecond = seconds > 0 ? outputTokens / seconds : 0;
  const totalTokensPerSecond = seconds > 0 ? totalTokens / seconds : 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    inputTokensPerSecond: Math.round(inputTokensPerSecond * 10) / 10,
    outputTokensPerSecond: Math.round(outputTokensPerSecond * 10) / 10,
    totalTokensPerSecond: Math.round(totalTokensPerSecond * 10) / 10,
  };
}

// ============================================================================
// BENCHMARKING ENGINE
// ============================================================================

async function runScenario(
  modelName: string,
  hardware: HardwareInfo,
  scenario: TestScenario,
  config: BenchmarkConfig,
  logger: Logger,
  attempt: number = 1
): Promise<DetailedBenchmarkResult> {
  const baseUrl = `http://${hardware.ollamaHost}:${hardware.ollamaPort}`;
  const startTime = Date.now();
  const messageFlow: MessageFlowEntry[] = [];

  logger.debugLog(`Running scenario: ${scenario.name} (attempt ${attempt})`);

  try {
    const llm = new ChatOllama({
      model: modelName,
      baseUrl,
      temperature: scenario.temperature,
    });

    const messages: BaseMessage[] = [
      new SystemMessage(scenario.systemPrompt),
      new HumanMessage(scenario.userPrompt),
    ];

    // Log message flow
    if (config.debug) {
      messageFlow.push({
        step: 1,
        role: 'system',
        content:
          scenario.systemPrompt.substring(0, 500) +
          (scenario.systemPrompt.length > 500 ? '...' : ''),
        tokenCount: estimateTokens(scenario.systemPrompt),
        timestamp: new Date().toISOString(),
      });
      messageFlow.push({
        step: 2,
        role: 'user',
        content: scenario.userPrompt,
        tokenCount: estimateTokens(scenario.userPrompt),
        timestamp: new Date().toISOString(),
      });
    }

    const response = await llm.invoke(messages);
    const latencyMs = Date.now() - startTime;

    let content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract thinking blocks
    const {
      thinking,
      response: cleanResponse,
      hasThinking,
    } = extractThinkingBlock(content);

    if (hasThinking) {
      content = cleanResponse;
      logger.debugLog('Detected thinking block', {
        thinkingLength: thinking.length,
        responseLength: cleanResponse.length,
      });
    }

    // Calculate metrics
    const inputText = scenario.systemPrompt + scenario.userPrompt;
    const tokenMetrics = calculateTokenMetrics(inputText, content, latencyMs);

    const thoughtMetrics: ThoughtProcessMetrics = {
      thinkingStartTime: startTime,
      thinkingEndTime: startTime + latencyMs,
      thinkingDurationMs: latencyMs,
      thinkingTokens: hasThinking ? estimateTokens(thinking) : 0,
      responseTokens: estimateTokens(cleanResponse),
      hasThinkingBlock: hasThinking,
      thinkingBlockContent: thinking.substring(0, 500),
    };

    // Log assistant response
    if (config.debug) {
      messageFlow.push({
        step: 3,
        role: 'assistant',
        content:
          content.substring(0, 500) + (content.length > 500 ? '...' : ''),
        tokenCount: estimateTokens(content),
        timestamp: new Date().toISOString(),
      });
      logger.logMessageFlow(messageFlow);
    }

    // Validate response
    const validation = scenario.validate(content);

    logger.debugLog(`Validation result:`, validation);

    return {
      model: modelName,
      useCase: scenario.useCase,
      scenario: scenario.name,
      success: validation.success,
      latencyMs,
      tokenMetrics,
      thoughtMetrics,
      responseLength: content.length,
      validationDetails: {
        ...validation.details,
        score: validation.score,
        scoreExplanation:
          validation.scoreExplanation ||
          generateScoreExplanation(validation.score, validation.details),
      },
      timestamp: new Date().toISOString(),
      attemptNumber: attempt,
      selfCorrected: attempt > 1,
      messageFlow: config.debug ? messageFlow : undefined,
    };
  } catch (error: any) {
    logger.error(`Scenario failed: ${error.message}`);
    return {
      model: modelName,
      useCase: scenario.useCase,
      scenario: scenario.name,
      success: false,
      latencyMs: Date.now() - startTime,
      tokenMetrics: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        inputTokensPerSecond: 0,
        outputTokensPerSecond: 0,
        totalTokensPerSecond: 0,
      },
      thoughtMetrics: {
        thinkingStartTime: startTime,
        thinkingEndTime: Date.now(),
        thinkingDurationMs: Date.now() - startTime,
        thinkingTokens: 0,
        responseTokens: 0,
        hasThinkingBlock: false,
      },
      responseLength: 0,
      validationDetails: { error: error.message },
      error: error.message,
      timestamp: new Date().toISOString(),
      attemptNumber: attempt,
      selfCorrected: false,
      messageFlow: config.debug ? messageFlow : undefined,
    };
  }
}

async function runMultiTurnScenario(
  modelName: string,
  hardware: HardwareInfo,
  scenario: TestScenario,
  config: BenchmarkConfig,
  logger: Logger
): Promise<DetailedBenchmarkResult> {
  const baseUrl = `http://${hardware.ollamaHost}:${hardware.ollamaPort}`;
  const startTime = Date.now();
  const responses: string[] = [];
  const messageFlow: MessageFlowEntry[] = [];

  logger.debugLog(`Running multi-turn scenario: ${scenario.name}`);

  try {
    const llm = new ChatOllama({
      model: modelName,
      baseUrl,
      temperature: scenario.temperature,
    });

    // Build conversation history
    let conversationMessages: BaseMessage[] = [
      new SystemMessage(scenario.systemPrompt),
    ];

    // Log system message
    if (config.debug) {
      messageFlow.push({
        step: 1,
        role: 'system',
        content:
          scenario.systemPrompt.substring(0, 500) +
          (scenario.systemPrompt.length > 500 ? '...' : ''),
        tokenCount: estimateTokens(scenario.systemPrompt),
        timestamp: new Date().toISOString(),
      });
    }

    // Execute each turn
    const turns = scenario.turns || [];
    let stepCounter = 2;

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];

      // Add user message
      conversationMessages.push(new HumanMessage(turn.userMessage));

      if (config.debug) {
        messageFlow.push({
          step: stepCounter++,
          role: 'user',
          content: turn.userMessage,
          tokenCount: estimateTokens(turn.userMessage),
          timestamp: new Date().toISOString(),
        });
      }

      // Get response
      const turnStartTime = Date.now();
      const response = await llm.invoke(conversationMessages);
      const turnLatency = Date.now() - turnStartTime;

      let content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      // Extract thinking blocks
      const {
        thinking,
        response: cleanResponse,
        hasThinking,
      } = extractThinkingBlock(content);
      if (hasThinking) {
        content = cleanResponse;
      }

      responses.push(content);

      // Add assistant response to conversation
      conversationMessages.push(new AIMessage(content));

      if (config.debug) {
        messageFlow.push({
          step: stepCounter++,
          role: 'assistant',
          content:
            content.substring(0, 500) + (content.length > 500 ? '...' : ''),
          tokenCount: estimateTokens(content),
          timestamp: new Date().toISOString(),
        });

        logger.info(`Turn ${i + 1} completed in ${turnLatency}ms`);
      }
    }

    const totalLatency = Date.now() - startTime;

    // Validate all responses together with turn context
    const validation = scenario.validate(responses, { turns });

    if (config.debug) {
      logger.logMessageFlow(messageFlow);
    }

    return {
      model: modelName,
      useCase: scenario.useCase,
      scenario: scenario.name,
      success: validation.success,
      latencyMs: totalLatency,
      tokenMetrics: {
        inputTokens: 0, // Complex to calculate for multi-turn
        outputTokens: 0,
        totalTokens: 0,
        inputTokensPerSecond: 0,
        outputTokensPerSecond: 0,
        totalTokensPerSecond: 0,
      },
      responseLength: responses.reduce((acc, r) => acc + r.length, 0),
      validationDetails: {
        ...validation.details,
        turnCount: responses.length,
        responses: responses.map((r) => r.substring(0, 100)),
        score: validation.score,
        scoreExplanation:
          validation.scoreExplanation ||
          generateScoreExplanation(validation.score, {
            ...validation.details,
            turnCount: responses.length,
          }),
      },
      timestamp: new Date().toISOString(),
      attemptNumber: 1,
      selfCorrected: false,
      messageFlow: config.debug ? messageFlow : undefined,
    };
  } catch (error: any) {
    logger.error(`Multi-turn scenario failed: ${error.message}`);
    return {
      model: modelName,
      useCase: scenario.useCase,
      scenario: scenario.name,
      success: false,
      latencyMs: Date.now() - startTime,
      tokenMetrics: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        inputTokensPerSecond: 0,
        outputTokensPerSecond: 0,
        totalTokensPerSecond: 0,
      },
      responseLength: 0,
      validationDetails: { error: error.message, responses },
      error: error.message,
      timestamp: new Date().toISOString(),
      attemptNumber: 1,
      selfCorrected: false,
      messageFlow: config.debug ? messageFlow : undefined,
    };
  }
}

// ============================================================================
// COMMAND LINE PARSING
// ============================================================================

function parseArgs(): BenchmarkConfig {
  const args = process.argv.slice(2);
  const config: BenchmarkConfig = {
    ollamaHost: process.env.OLLAMA_HOST || 'localhost',
    ollamaPort: parseInt(process.env.OLLAMA_PORT || '11434'),
    cudaVisibleDevices: process.env.CUDA_VISIBLE_DEVICES,
    verbose: false,
    debug: false,
    enableSelfCorrection: true,
    saveGraphs: true,
    contextWindowTest: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(`
${COLORS.bright}Ollama Model Screener & Fitness Analyzer${COLORS.reset}

Usage: pnpm exec tsx scripts/ollama-model-screener.ts [options]

Options:
  --host <host>              Ollama server host (default: localhost)
  --port <port>              Ollama server port (default: 11434)
  --cuda <devices>           CUDA visible devices (default: from env)
  --max-vram <gb>            Maximum VRAM per GPU in GB
  --quantizations <q1,q2>    Filter by quantization (e.g., Q4_K_M,Q5_K_M)
  --families <f1,f2>         Filter by family (e.g., llama,qwen,gemma)
  --exclude <f1,f2>          Exclude families (e.g., deepseek)
  --benchmark                Run benchmarks on screened models
  --output <path>            Output file path (default: ollama-screener-results.json)
  --verbose, -v              Enable verbose logging
  --debug, -d                Enable debug mode (shows full message flow)
  --no-self-correction       Disable self-correction testing
  --no-graphs                Disable HTML graph generation
  --max-models <n>           Test at most N models
  --context-window-test      Test context window sizes
  --help, -h                 Show this help

Environment Variables:
  OLLAMA_HOST                Ollama server host
  OLLAMA_PORT                Ollama server port
  CUDA_VISIBLE_DEVICES       GPU device selection

Examples:
  # Basic screening
  pnpm exec tsx scripts/ollama-model-screener.ts --max-vram 8

  # Full benchmark with debug mode
  pnpm exec tsx scripts/ollama-model-screener.ts --max-vram 8 --benchmark --debug

  # Test context windows
  pnpm exec tsx scripts/ollama-model-screener.ts --benchmark --context-window-test

  # Filter by family and quantization
  pnpm exec tsx scripts/ollama-model-screener.ts --families llama --quantizations Q4_K_M --benchmark
`);
      process.exit(0);
    }

    if (arg === '--host' && args[i + 1]) {
      config.ollamaHost = args[i + 1];
      i++;
    } else if (arg === '--port' && args[i + 1]) {
      config.ollamaPort = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--cuda' && args[i + 1]) {
      config.cudaVisibleDevices = args[i + 1];
      i++;
    } else if (arg === '--max-vram' && args[i + 1]) {
      config.maxVRAMGB = parseFloat(args[i + 1]);
      i++;
    } else if (arg === '--quantizations' && args[i + 1]) {
      config.quantizations = args[i + 1]
        .split(',')
        .map((q) => q.trim().toUpperCase());
      i++;
    } else if (arg === '--families' && args[i + 1]) {
      config.families = args[i + 1].split(',').map((f) => f.trim());
      i++;
    } else if (arg === '--exclude' && args[i + 1]) {
      config.excludeFamilies = args[i + 1].split(',').map((f) => f.trim());
      i++;
    } else if (arg === '--benchmark' || arg === '-b') {
      config.benchmark = true;
    } else if ((arg === '--output' || arg === '-o') && args[i + 1]) {
      config.output = args[i + 1];
      i++;
    } else if (arg === '--verbose' || arg === '-v') {
      config.verbose = true;
    } else if (arg === '--debug' || arg === '-d') {
      config.debug = true;
    } else if (arg === '--no-self-correction') {
      config.enableSelfCorrection = false;
    } else if (arg === '--no-graphs') {
      config.saveGraphs = false;
    } else if (arg === '--max-models' && args[i + 1]) {
      config.maxModels = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--context-window-test') {
      config.contextWindowTest = true;
    }
  }

  if (!config.output) {
    config.output = 'ollama-screener-results.json';
  }

  return config;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const config = parseArgs();
  const logger = new Logger(config.verbose, config.debug);
  const outputPath = config.output || 'ollama-screener-results.json';

  console.log(
    '\n' +
      COLORS.bright +
      COLORS.cyan +
      '╔══════════════════════════════════════════════════════════════════╗\n' +
      '║      Ollama Model Screener & Fitness Analyzer                    ║\n' +
      '║      Real-World AI Orchestrator Testing                          ║\n' +
      '╚══════════════════════════════════════════════════════════════════╝' +
      COLORS.reset +
      '\n'
  );

  logger.info('Configuration:', {
    ollama: `${config.ollamaHost}:${config.ollamaPort}`,
    maxVRAM: config.maxVRAMGB ? `${config.maxVRAMGB}GB` : 'unlimited',
    quantizations: config.quantizations || 'all',
    families: config.families || 'all',
    benchmark: config.benchmark ? 'enabled' : 'disabled',
    verbose: config.verbose ? 'enabled' : 'disabled',
    debug: config.debug ? 'enabled' : 'disabled',
    contextWindowTest: config.contextWindowTest ? 'enabled' : 'disabled',
  });

  logger.section('Hardware Detection');
  const hardware = await detectHardware();

  if (hardware.gpus.length > 0) {
    logger.success(`Detected ${hardware.gpus.length} GPU(s)`);
    for (const gpu of hardware.gpus) {
      logger.info(
        `  GPU ${gpu.index}: ${gpu.name} (${Math.round(
          gpu.vramTotalMB / 1024
        )}GB VRAM)`
      );
    }
  } else {
    logger.warn('No GPUs detected - will run on CPU');
  }

  logger.section('Fetching Available Models');
  const models = await fetchAvailableModels(
    config.ollamaHost,
    config.ollamaPort
  );
  logger.success(`Found ${models.length} models`);

  // Screen models
  logger.section('Screening Models');
  const screened: ScreenedModel[] = [];

  for (const model of models) {
    const vramEstimate = estimateVRAM(model);
    const totalFreeVRAMMB = hardware.gpus.reduce(
      (sum, g) => sum + g.vramFreeMB,
      0
    );
    const maxVRAMMB = config.maxVRAMGB
      ? config.maxVRAMGB * 1024
      : totalFreeVRAMMB;

    // Check filters
    if (config.maxVRAMGB && vramEstimate.totalVRAMMB > maxVRAMMB) {
      logger.debugLog(`Skipping ${model.name}: exceeds VRAM limit`);
      continue;
    }

    if (config.quantizations?.length) {
      if (
        !config.quantizations.some((q) => model.name.toUpperCase().includes(q))
      ) {
        logger.debugLog(`Skipping ${model.name}: quantization mismatch`);
        continue;
      }
    }

    if (config.families?.length) {
      const family = model.details?.family || '';
      if (
        !config.families.some((f) =>
          family.toLowerCase().includes(f.toLowerCase())
        )
      ) {
        continue;
      }
    }

    // Calculate fit score
    const vramUtilization = vramEstimate.totalVRAMMB / Math.max(maxVRAMMB, 1);
    const quantizationScore =
      (QUANTIZATION_FACTORS[vramEstimate.quantization] || 0.5) * 100;
    const fitScore = Math.min(
      100,
      Math.max(
        0,
        Math.round((1 - vramUtilization) * 50 + quantizationScore * 0.5)
      )
    );

    const suitability: string[] = [];
    if (fitScore >= 70) suitability.push('all');
    else if (fitScore >= 50) suitability.push('light');
    else suitability.push('cpu_fallback');

    screened.push({ ...model, ...vramEstimate, fitScore, suitability });
  }

  screened.sort((a, b) => b.fitScore - a.fitScore);

  if (config.maxModels) {
    logger.info(`Limiting to top ${config.maxModels} models`);
    screened.splice(config.maxModels);
  }

  logger.success(`${screened.length} models passed screening`);

  if (screened.length === 0) {
    logger.error('No models matched the criteria');
    process.exit(1);
  }

  // Run benchmarks
  let allResults: DetailedBenchmarkResult[] = [];
  const contextWindowResults: ContextWindowTestResult[] = [];

  if (config.benchmark) {
    const modelNames = screened.map((m) => m.name);

    logger.section('Running Benchmarks');

    for (const model of modelNames) {
      logger.info(`Testing model: ${COLORS.bright}${model}${COLORS.reset}`);

      for (const suite of TEST_SUITES) {
        logger.info(`  Suite: ${suite.name}`);

        for (const scenario of suite.scenarios) {
          logger.info(`    Scenario: ${scenario.name}`);

          let result: DetailedBenchmarkResult;

          if (scenario.isMultiTurn && scenario.turns) {
            result = await runMultiTurnScenario(
              model,
              hardware,
              scenario,
              config,
              logger
            );
          } else {
            result = await runScenario(
              model,
              hardware,
              scenario,
              config,
              logger
            );
          }

          allResults.push(result);

          const status = result.success
            ? COLORS.green + '✓' + COLORS.reset
            : COLORS.red + '✗' + COLORS.reset;

          const score = result.validationDetails?.score ?? 0;
          const scoreExplanation =
            result.validationDetails?.scoreExplanation ||
            'No explanation available';

          logger.info(`${COLORS.bright}${scenario.name}${COLORS.reset}`);
          logger.info(
            `  ${status} Score: ${COLORS.bright}${score}/100${COLORS.reset}`
          );
          // Log the detailed score explanation
          if (config.verbose || score < 100) {
            logger.info(
              `    ${COLORS.cyan}→${COLORS.reset} ${scoreExplanation}`
            );
          }
        }
      }
    }

    // Test context windows if requested
    if (config.contextWindowTest) {
      logger.section('Testing Context Windows');

      for (const model of modelNames.slice(0, 3)) {
        // Test top 3 models
        const result = await detectContextWindow(model, hardware, logger);
        contextWindowResults.push(result);

        const status = result.testPassed
          ? COLORS.green + '✓' + COLORS.reset
          : COLORS.red + '✗' + COLORS.reset;

        logger.info(
          `${status} ${model}: ${
            result.maxContextSize > 0
              ? result.maxContextSize + ' tokens'
              : 'FAILED'
          }`
        );

        if (config.verbose) {
          for (const detail of result.details) {
            logger.info(`  ${detail}`);
          }
        }
      }
    }
  }

  logger.section('Complete');
  logger.success('Model screening and benchmarking finished successfully!');

  const modelRankings = calculateModelRankings(allResults, screened);
  printModelSummary(modelRankings, logger);

  const outputData = {
    timestamp: new Date().toISOString(),
    screenedModels: screened,
    benchmarkResults: allResults,
    contextWindowResults,
    modelRankings,
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  logger.info('Results saved to: ' + COLORS.bright + outputPath + COLORS.reset);

  if (config.saveGraphs && allResults.length > 0) {
    const graphPath = outputPath.replace('.json', '-graphs.html');
    generateBenchmarkGraphs(allResults, modelRankings, graphPath);
  }

  if (config.debug) {
    logger.info(
      'Debug logs saved to: ' +
        COLORS.bright +
        outputPath.replace('.json', '.log') +
        COLORS.reset
    );
  }
}

interface ModelRanking {
  name: string;
  overallScore: number;
  successRate: number;
  avgLatency: number;
  scenarioScores: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  fitScore: number;
  recommendation: string;
}

function calculateModelRankings(
  results: DetailedBenchmarkResult[],
  screened: ScreenedModel[]
): ModelRanking[] {
  const models = Array.from(new Set(results.map((r) => r.model)));

  const modelFitScores: Record<string, number> = {};
  for (const m of screened) {
    modelFitScores[m.name] = m.fitScore;
  }

  return models
    .map((model) => {
      const modelResults = results.filter((r) => r.model === model);
      const scores = modelResults.map((r) => r.validationDetails?.score ?? 0);
      const avgScore =
        scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0;
      const successCount = modelResults.filter((r) => r.success).length;
      const successRate =
        modelResults.length > 0
          ? (successCount / modelResults.length) * 100
          : 0;
      const avgLatency =
        modelResults.length > 0
          ? modelResults.reduce((a, b) => a + b.latencyMs, 0) /
            modelResults.length
          : 0;

      const scenarioScores: Record<string, number> = {};
      const scenarioLatencies: Record<string, number[]> = {};
      for (const r of modelResults) {
        scenarioScores[r.scenario] = r.validationDetails?.score ?? 0;
        if (!scenarioLatencies[r.scenario]) scenarioLatencies[r.scenario] = [];
        scenarioLatencies[r.scenario].push(r.latencyMs);
      }

      const strengths: string[] = [];
      const weaknesses: string[] = [];
      for (const [scenario, score] of Object.entries(scenarioScores)) {
        if (score >= 80) {
          strengths.push(scenario.substring(0, 30));
        } else if (score < 50) {
          weaknesses.push(scenario.substring(0, 30) + ' (' + score + ')');
        }
      }

      let recommendation = '';
      if (avgScore >= 80 && successRate >= 80) {
        recommendation = 'EXCELLENT - Recommended for production use';
      } else if (avgScore >= 60 && successRate >= 60) {
        recommendation = 'GOOD - Suitable for most use cases';
      } else if (avgScore >= 40 || successRate >= 50) {
        recommendation = 'ACCEPTABLE - May need human oversight';
      } else {
        recommendation = 'NOT RECOMMENDED - Consider alternatives';
      }

      return {
        name: model,
        overallScore: Math.round(avgScore),
        successRate: Math.round(successRate),
        avgLatency: Math.round(avgLatency),
        scenarioScores,
        strengths: strengths.slice(0, 5),
        weaknesses: weaknesses.slice(0, 5),
        fitScore: modelFitScores[model] || 0,
        recommendation,
      };
    })
    .sort((a, b) => b.overallScore - a.overallScore);
}

function printModelSummary(rankings: ModelRanking[], logger: Logger): void {
  logger.section('Model Rankings');

  console.log(
    '\n' +
      COLORS.bright +
      COLORS.cyan +
      '═══════════════════════════════════════════════════════════════════' +
      COLORS.reset
  );
  console.log(
    COLORS.bright +
      COLORS.cyan +
      '                     MODEL BENCHMARK SUMMARY' +
      COLORS.reset
  );
  console.log(
    COLORS.bright +
      COLORS.cyan +
      '═══════════════════════════════════════════════════════════════════' +
      COLORS.reset +
      '\n'
  );

  const best = rankings[0];
  console.log(
    COLORS.green +
      '★ BEST MODEL: ' +
      COLORS.reset +
      COLORS.bright +
      best.name +
      COLORS.reset
  );
  console.log(
    '   Score: ' + COLORS.bright + best.overallScore + '/100' + COLORS.reset
  );
  console.log(
    '   Success Rate: ' + COLORS.bright + best.successRate + '%' + COLORS.reset
  );
  console.log(
    '   Avg Latency: ' + COLORS.bright + best.avgLatency + 'ms' + COLORS.reset
  );
  console.log(
    '   Recommendation: ' +
      COLORS.bright +
      best.recommendation +
      COLORS.reset +
      '\n'
  );

  console.log(COLORS.bright + 'Full Rankings:' + COLORS.reset);
  console.log('─'.repeat(80));

  const rankWidth = 4;
  const nameWidth = 40;
  const scoreWidth = 8;
  const rateWidth = 10;
  const latWidth = 10;

  console.log(
    COLORS.gray +
      'RANK'.padEnd(rankWidth) +
      'MODEL'.padEnd(nameWidth) +
      'SCORE'.padEnd(scoreWidth) +
      'SUCCESS'.padEnd(rateWidth) +
      'LATENCY'.padEnd(latWidth) +
      'RECOMMENDATION' +
      COLORS.reset
  );

  for (let i = 0; i < rankings.length; i++) {
    const r = rankings[i];
    const rank = '#' + (i + 1);
    const scoreColor =
      r.overallScore >= 80
        ? COLORS.green
        : r.overallScore >= 50
        ? COLORS.yellow
        : COLORS.red;
    const rateColor =
      r.successRate >= 80
        ? COLORS.green
        : r.successRate >= 50
        ? COLORS.yellow
        : COLORS.red;

    let recText = r.recommendation;
    if (recText.includes('EXCELLENT')) recText = '★★★★★';
    else if (recText.includes('GOOD')) recText = '★★★★☆';
    else if (recText.includes('ACCEPTABLE')) recText = '★★★☆☆';
    else recText = '★★☆☆☆';

    const row =
      COLORS.bright +
      rank.padEnd(rankWidth) +
      COLORS.reset +
      r.name.substring(0, nameWidth - 1).padEnd(nameWidth) +
      scoreColor +
      String(r.overallScore).padEnd(scoreWidth) +
      COLORS.reset +
      rateColor +
      String(r.successRate) +
      '%'.padEnd(rateWidth) +
      COLORS.reset +
      COLORS.cyan +
      String(r.avgLatency) +
      'ms'.padEnd(latWidth) +
      COLORS.reset +
      scoreColor +
      recText +
      COLORS.reset;

    console.log(row);

    if (r.strengths.length > 0) {
      console.log(
        '    ' +
          COLORS.green +
          '✓ ' +
          COLORS.reset +
          r.strengths.slice(0, 2).join(', ')
      );
    }
    if (r.weaknesses.length > 0) {
      console.log(
        '    ' +
          COLORS.red +
          '✗ ' +
          COLORS.reset +
          r.weaknesses.slice(0, 2).join(', ')
      );
    }
  }

  console.log('─'.repeat(80) + '\n');

  const top3 = rankings.slice(0, 3);
  if (top3.length > 1) {
    console.log(COLORS.bright + 'Quick Comparison:' + COLORS.reset);
    for (const r of top3) {
      console.log(
        '  ' +
          r.name +
          ': ' +
          r.overallScore +
          '/100 (' +
          r.successRate +
          '% success, ' +
          r.avgLatency +
          'ms avg)'
      );
    }
  }
}

function generateBenchmarkGraphs(
  results: DetailedBenchmarkResult[],
  rankings: ModelRanking[],
  outputPath: string
): void {
  const models = Array.from(new Set(results.map((r) => r.model)));
  const scenarios = Array.from(new Set(results.map((r) => r.scenario)));

  const modelData: Record<
    string,
    { scores: Record<string, number>; avgLatency: number }
  > = {};
  for (const model of models) {
    modelData[model] = { scores: {}, avgLatency: 0 };
  }

  let totalLatencyByModel: Record<string, number> = {};
  let countByModel: Record<string, number> = {};

  for (const result of results) {
    const score = result.validationDetails?.score ?? 0;
    modelData[result.model].scores[result.scenario] = score;
    totalLatencyByModel[result.model] =
      (totalLatencyByModel[result.model] || 0) + result.latencyMs;
    countByModel[result.model] = (countByModel[result.model] || 0) + 1;
  }

  for (const model of models) {
    modelData[model].avgLatency =
      countByModel[model] > 0
        ? Math.round(totalLatencyByModel[model] / countByModel[model])
        : 0;
  }

  const avgScores = models.map((m) => {
    const scores = Object.values(modelData[m].scores);
    return scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
  });

  const maxScore = Math.max(...avgScores, 100);

  const scenariosChart = scenarios
    .map((name, i) => {
      const heights = models.map((m) => {
        const score = modelData[m].scores[name] ?? 0;
        return Math.round((score / 100) * 200);
      });
      return (
        '{ name: "' +
        name.substring(0, 25) +
        '", scores: [' +
        heights.join(', ') +
        '] }'
      );
    })
    .join(',\n      ');

  const timestamp = new Date().toISOString();

  const rankingTable = rankings
    .map((r, i) => {
      const scoreColor =
        r.overallScore >= 80
          ? '#00ff88'
          : r.overallScore >= 50
          ? '#ffaa00'
          : '#ff4444';
      const stars = r.recommendation.includes('EXCELLENT')
        ? '★★★★★'
        : r.recommendation.includes('GOOD')
        ? '★★★★☆'
        : r.recommendation.includes('ACCEPTABLE')
        ? '★★★☆☆'
        : '★★☆☆☆';
      return (
        '<tr style="border-bottom: 1px solid #333;">' +
        '<td style="padding: 10px; font-weight: bold; color: #00d9ff;">#' +
        (i + 1) +
        '</td>' +
        '<td style="padding: 10px;">' +
        r.name +
        '</td>' +
        '<td style="padding: 10px; color: ' +
        scoreColor +
        '; font-weight: bold;">' +
        r.overallScore +
        '/100</td>' +
        '<td style="padding: 10px;">' +
        r.successRate +
        '%</td>' +
        '<td style="padding: 10px;">' +
        r.avgLatency +
        'ms</td>' +
        '<td style="padding: 10px;">' +
        stars +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  const modelCards = rankings
    .map((r, i) => {
      const scoreColor =
        r.overallScore >= 80
          ? '#00ff88'
          : r.overallScore >= 50
          ? '#ffaa00'
          : '#ff4444';
      const strengths =
        r.strengths.length > 0
          ? '<div style="margin-top: 10px;"><strong style="color: #00ff88;">✓ Strengths:</strong> ' +
            r.strengths.join(', ') +
            '</div>'
          : '';
      const weaknesses =
        r.weaknesses.length > 0
          ? '<div style="margin-top: 5px;"><strong style="color: #ff4444;">✗ Weaknesses:</strong> ' +
            r.weaknesses.join(', ') +
            '</div>'
          : '';

      return (
        '<div class="model-card" style="border-left: 4px solid ' +
        scoreColor +
        ';">' +
        '<div style="display: flex; justify-content: space-between; align-items: center;">' +
        '<h3 style="margin: 0; color: #00d9ff;">#' +
        (i + 1) +
        ' ' +
        r.name +
        '</h3>' +
        '<span style="font-size: 24px; color: ' +
        scoreColor +
        ';">' +
        r.overallScore +
        '/100</span></div>' +
        '<p><strong>Success Rate:</strong> ' +
        r.successRate +
        '% | <strong>Avg Latency:</strong> ' +
        r.avgLatency +
        'ms</p>' +
        '<p><strong>Recommendation:</strong> ' +
        r.recommendation +
        '</p>' +
        strengths +
        weaknesses +
        '</div>'
      );
    })
    .join('');

  const html =
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>Model Benchmark Results</title>\n' +
    '  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n' +
    '  <style>\n' +
    '    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; background: #1a1a2e; color: #eee; }\n' +
    '    h1 { color: #00d9ff; }\n' +
    '    h2 { color: #00ff88; margin-top: 30px; }\n' +
    '    h3 { color: #00d9ff; }\n' +
    '    .chart-container { background: #16213e; padding: 20px; border-radius: 10px; margin: 20px 0; }\n' +
    '    table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #16213e; }\n' +
    '    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #333; }\n' +
    '    th { background: #0f3460; color: #00d9ff; }\n' +
    '    .score-100 { color: #00ff88; }\n' +
    '    .score-50 { color: #ffaa00; }\n' +
    '    .score-0 { color: #ff4444; }\n' +
    '    .model-card { background: #16213e; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #00d9ff; }\n' +
    '    .winner { border: 2px solid #ffd700; box-shadow: 0 0 20px rgba(255, 215, 0, 0.3); }\n' +
    '  </style>\n' +
    '</head>\n' +
    '<body>\n' +
    '  <h1>Model Benchmark Results</h1>\n' +
    '  <p>Generated: ' +
    timestamp +
    '</p>\n' +
    '  <div class="chart-container">\n' +
    '    <h2>🏆 Model Rankings</h2>\n' +
    '    <table><thead><tr><th>Rank</th><th>Model</th><th>Score</th><th>Success</th><th>Latency</th><th>Rating</th></tr></thead><tbody>' +
    rankingTable +
    '</tbody></table>\n' +
    '  </div>\n' +
    '  <div class="chart-container">\n' +
    '    <h2>Overall Model Scores</h2>\n' +
    '    <canvas id="overallChart"></canvas>\n' +
    '  </div>\n' +
    '  <div class="chart-container">\n' +
    '    <h2>Scores by Scenario</h2>\n' +
    '    <canvas id="scenarioChart"></canvas>\n' +
    '  </div>\n' +
    '  <div class="chart-container">\n' +
    '    <h2>Average Latency by Model (ms)</h2>\n' +
    '    <canvas id="latencyChart"></canvas>\n' +
    '  </div>\n' +
    '  <h2>Detailed Results</h2>\n' +
    modelCards +
    '  <script>\n' +
    '    var models = ' +
    JSON.stringify(
      rankings.map((r) => '#' + (rankings.indexOf(r) + 1) + ' ' + r.name)
    ) +
    ';\n' +
    '    var avgScores = ' +
    JSON.stringify(rankings.map((r) => r.overallScore)) +
    ';\n' +
    '    var avgLatencies = ' +
    JSON.stringify(rankings.map((r) => r.avgLatency)) +
    ';\n' +
    '    var scenarioData = [\n      ' +
    scenariosChart +
    '\n    ];\n' +
    '    var chartColors = avgScores.map(function(s) { return s >= 80 ? "#00ff88" : s >= 50 ? "#ffaa00" : "#ff4444"; });\n' +
    '    new Chart(document.getElementById("overallChart"), {\n' +
    '      type: "bar",\n' +
    '      data: {\n' +
    '        labels: models,\n' +
    '        datasets: [{ label: "Average Score", data: avgScores, backgroundColor: chartColors }]\n' +
    '      },\n' +
    '      options: { scales: { y: { max: 100 } } }\n' +
    '    });\n' +
    '    var scenarioDatasets = scenarioData.map(function(s, i) {\n' +
    '      return { label: s.name, data: s.scores, backgroundColor: "hsl(" + (i * 360 / scenarioData.length) + ", 70%, 50%)" };\n' +
    '    });\n' +
    '    new Chart(document.getElementById("scenarioChart"), {\n' +
    '      type: "bar",\n' +
    '      data: { labels: models, datasets: scenarioDatasets },\n' +
    '      options: { scales: { y: { max: 100 } }, indexAxis: "y" }\n' +
    '    });\n' +
    '    new Chart(document.getElementById("latencyChart"), {\n' +
    '      type: "bar",\n' +
    '      data: { labels: models, datasets: [{ label: "Avg Latency (ms)", data: avgLatencies, backgroundColor: "#00d9ff" }] }\n' +
    '    });\n' +
    '  <' +
    '/script>\n' +
    '</body>\n' +
    '</html>';

  fs.writeFileSync(outputPath, html);
  console.log('Graphs saved to: ' + outputPath);
}

// Run main
main().catch((error) => {
  console.error(COLORS.red + 'Screener failed:' + COLORS.reset, error);
  process.exit(1);
});
