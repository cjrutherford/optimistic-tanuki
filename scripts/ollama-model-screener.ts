#!/usr/bin/env node
/**
 * Ollama Model Screener & Benchmark Script
 *
 * Discovers, screens, and benchmarks Ollama models based on GPU/hardware constraints.
 * Patterns after ai-orchestrator's three use cases: workflow_control, tool_calling, conversational.
 *
 * Usage: npx tsx scripts/ollama-model-screener.ts [options]
 */

import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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

interface BenchmarkResult {
  model: string;
  useCase: string;
  scenario: string;
  success: boolean;
  tps?: number;
  latencyMs: number;
  responseLength: number;
  validationDetails?: Record<string, any>;
  error?: string;
}

interface ScreenedModel extends ModelInfo, VRAMEstimate {
  fitScore: number;
  suitability: string[];
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
}

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

const BENCHMARK_SCENARIOS = [
  {
    name: 'Simple Greeting Detection',
    useCase: 'workflow_control' as const,
    systemPrompt: `You are a workflow classifier. Classify prompts as:
- "conversational" for greetings, general chat
- "tool_calling" for action requests
- "hybrid" for both

Respond with JSON: {"type": "...", "confidence": 0.0-1.0}`,
    userPrompt: 'Hello, how are you today?',
    temperature: 0.3,
    validate: (response: string) => {
      const isConversational = response
        .toLowerCase()
        .includes('conversational');
      return {
        success: isConversational,
        detected: isConversational ? 'conversational' : 'unknown',
      };
    },
  },
  {
    name: 'Action Request Detection',
    useCase: 'workflow_control' as const,
    systemPrompt: `You are a workflow classifier. Available tools: create_project, list_tasks
Classify the prompt as: "conversational" | "tool_calling" | "hybrid"
Respond with JSON only.`,
    userPrompt: 'Create a new project called Website Redesign',
    temperature: 0.3,
    validate: (response: string) => {
      const hasTool = response.toLowerCase().includes('tool');
      return {
        success: hasTool,
        detected: hasTool ? 'tool_calling' : 'unknown',
      };
    },
  },
  {
    name: 'Function Call Format',
    useCase: 'tool_calling' as const,
    systemPrompt: `You are an AI assistant. Available tools: create_project(name: string)
When action needed, respond with JSON: {"name": "tool_name", "arguments": {...}}`,
    userPrompt: 'Create a project called Q1 Marketing Campaign',
    temperature: 0.5,
    validate: (response: string) => {
      const hasName = response.includes('"name"');
      const hasArgs = response.includes('"arguments"');
      return { success: hasName && hasArgs, hasToolCall: hasName && hasArgs };
    },
  },
  {
    name: 'JSON Object Generation',
    useCase: 'tool_calling' as const,
    systemPrompt: `You are a data formatter. Convert user requests to JSON objects.
Format: {"name": "...", "parameters": {...}}`,
    userPrompt: 'List all projects for user id 123',
    temperature: 0.5,
    validate: (response: string) => {
      const hasJsonObject = response.includes('{') && response.includes('}');
      return { success: hasJsonObject, isJson: hasJsonObject };
    },
  },
  {
    name: 'Natural Response',
    useCase: 'conversational' as const,
    systemPrompt:
      'You are a helpful assistant. Provide clear, natural responses.',
    userPrompt:
      'Explain what TELOS means in project management in one paragraph',
    temperature: 0.7,
    validate: (response: string) => {
      const reasonableLength = response.length > 50 && response.length < 2000;
      return { success: reasonableLength, responseLength: response.length };
    },
  },
  {
    name: 'Creative Explanation',
    useCase: 'conversational' as const,
    systemPrompt:
      'You are an educational assistant. Explain concepts with examples.',
    userPrompt: 'What are the benefits of agile project management?',
    temperature: 0.7,
    validate: (response: string) => {
      const hasSubstance = response.length > 80;
      return { success: hasSubstance, responseLength: response.length };
    },
  },
];

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
  const match = sizeStr.toUpperCase().match(/([\d.]+)([BMK])?/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2];
  if (unit === 'K') return value / 1000;
  if (unit === 'M') return value / 1000000;
  return value * 1e9;
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

function calculateFitScore(
  vramEstimate: VRAMEstimate,
  hardware: HardwareInfo,
  config: BenchmarkConfig
): number {
  const totalFreeVRAMMB = hardware.gpus.reduce(
    (sum, g) => sum + g.vramFreeMB,
    0
  );
  const maxVRAMMB = config.maxVRAMGB
    ? config.maxVRAMGB * 1024
    : totalFreeVRAMMB;

  if (vramEstimate.totalVRAMMB > maxVRAMMB) return 0;

  const vramUtilization = vramEstimate.totalVRAMMB / maxVRAMMB;
  const quantizationScore =
    (QUANTIZATION_FACTORS[vramEstimate.quantization] || 0.5) * 100;

  const score = (1 - vramUtilization) * 50 + quantizationScore * 0.5;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function screenModels(
  models: ModelInfo[],
  hardware: HardwareInfo,
  config: BenchmarkConfig
): ScreenedModel[] {
  const screened: ScreenedModel[] = [];

  for (const model of models) {
    const vramEstimate = estimateVRAM(model);
    const fitScore = calculateFitScore(vramEstimate, hardware, config);

    if (
      config.maxVRAMGB &&
      vramEstimate.totalVRAMMB > config.maxVRAMGB * 1024
    ) {
      continue;
    }

    if (config.quantizations?.length) {
      if (
        !config.quantizations.some((q) => model.name.toUpperCase().includes(q))
      ) {
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

    if (config.excludeFamilies?.length) {
      const family = model.details?.family || '';
      if (
        config.excludeFamilies.some((f) =>
          family.toLowerCase().includes(f.toLowerCase())
        )
      ) {
        continue;
      }
    }

    const suitability: string[] = [];
    if (fitScore >= 70) suitability.push('all');
    else if (fitScore >= 50) suitability.push('light');
    else suitability.push('cpu_fallback');

    screened.push({
      ...model,
      ...vramEstimate,
      fitScore,
      suitability,
    });
  }

  return screened.sort((a, b) => b.fitScore - a.fitScore);
}

async function benchmarkModel(
  modelName: string,
  hardware: HardwareInfo,
  scenario: (typeof BENCHMARK_SCENARIOS)[0]
): Promise<BenchmarkResult> {
  const baseUrl = `http://${hardware.ollamaHost}:${hardware.ollamaPort}`;
  const startTime = Date.now();

  try {
    const llm = new ChatOllama({
      model: modelName,
      baseUrl,
      temperature: scenario.temperature,
    });

    const messages = [
      new SystemMessage(scenario.systemPrompt),
      new HumanMessage(scenario.userPrompt),
    ];

    const response = await llm.invoke(messages);
    const latencyMs = Date.now() - startTime;

    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    const validation = scenario.validate(content);
    const tokensPerSecond =
      response.content.length > 0
        ? response.content.length / (latencyMs / 1000)
        : 0;

    return {
      model: modelName,
      useCase: scenario.useCase,
      scenario: scenario.name,
      success: validation.success,
      tps: Math.round(tokensPerSecond * 10) / 10,
      latencyMs,
      responseLength: content.length,
      validationDetails: validation,
    };
  } catch (error: any) {
    return {
      model: modelName,
      useCase: scenario.useCase,
      scenario: scenario.name,
      success: false,
      latencyMs: Date.now() - startTime,
      responseLength: 0,
      error: error.message,
    };
  }
}

async function runBenchmarks(
  models: string[],
  hardware: HardwareInfo
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  console.log('\nRunning benchmarks...\n');

  for (const model of models) {
    console.log(`  Testing: ${model}`);

    for (const scenario of BENCHMARK_SCENARIOS) {
      const result = await benchmarkModel(model, hardware, scenario);
      results.push(result);
    }
  }

  return results;
}

function printResultsTable(
  screened: ScreenedModel[],
  results: BenchmarkResult[],
  hardware: HardwareInfo
) {
  console.log('\n' + '='.repeat(100));
  console.log('OLLAMA MODEL SCREENER RESULTS');
  console.log('='.repeat(100));

  console.log('\n📊 Hardware Configuration:');
  if (hardware.gpus.length > 0) {
    for (const gpu of hardware.gpus) {
      console.log(
        `  GPU ${gpu.index}: ${gpu.name} (${gpu.vramTotalMB}MB total, ${gpu.vramFreeMB}MB free)`
      );
    }
  } else {
    console.log('  No NVIDIA GPUs detected - using CPU only');
  }

  console.log('\n📦 Screened Models (sorted by fit score):');
  console.log('-'.repeat(100));
  console.log(
    ' MODEL'.padEnd(28) +
    ' PARAMS'.padEnd(10) +
    ' QUANT'.padEnd(8) +
    ' VRAM'.padEnd(10) +
    ' FIT'.padEnd(6) +
    ' SUITABILITY'
  );
  console.log('-'.repeat(100));

  for (const model of screened) {
    const params =
      model.parameterSizeB >= 1e9
        ? `${(model.parameterSizeB / 1e9).toFixed(1)}B`
        : `${(model.parameterSizeB / 1e6).toFixed(0)}M`;

    console.log(
      ` ${model.name.substring(0, 27).padEnd(27)}` +
      ` ${params.padEnd(9)}` +
      ` ${model.quantization.padEnd(7)}` +
      ` ${model.totalVRAMMB}MB`.padEnd(9) +
      ` ${model.fitScore}`.padEnd(5) +
      ` ${model.suitability.join(', ')}`
    );
  }

  console.log('\n⚡ Benchmark Results (by use case):');
  console.log('-'.repeat(100));

  const useCases = ['workflow_control', 'tool_calling', 'conversational'];
  const useCaseLabels: Record<string, string> = {
    workflow_control: '🔍 Workflow Control (temp=0.3)',
    tool_calling: '🔧 Tool Calling (temp=0.5)',
    conversational: '💬 Conversational (temp=0.7)',
  };

  for (const useCase of useCases) {
    const useCaseResults = results.filter((r) => r.useCase === useCase);
    const successful = useCaseResults.filter((r) => r.success);
    const avgTps =
      successful.length > 0
        ? successful.reduce((sum, r) => sum + (r.tps || 0), 0) /
        successful.length
        : 0;

    console.log(`\n${useCaseLabels[useCase]}`);
    console.log(
      `  Success Rate: ${successful.length}/${useCaseResults.length
      } (${Math.round((successful.length / useCaseResults.length) * 100)}%)`
    );
    console.log(`  Avg TPS: ${avgTps.toFixed(1)}`);

    console.log('  ' + '-'.repeat(70));
    console.log(
      '   MODEL'.padEnd(25) +
      ' SCENARIO'.padEnd(25) +
      ' TPS'.padEnd(10) +
      ' LATENCY'.padEnd(12) +
      ' STATUS'
    );
    console.log('  ' + '-'.repeat(70));

    for (const r of useCaseResults) {
      const status = r.success ? '✓' : '✗';
      const tps = r.tps?.toString().padEnd(9) || '-'.padEnd(9);
      const latency = `${r.latencyMs}ms`.padEnd(11);

      console.log(
        `   ${r.model.substring(0, 24).padEnd(24)}` +
        ` ${r.scenario.substring(0, 24).padEnd(24)}` +
        ` ${tps}` +
        ` ${latency}` +
        ` ${status}`
      );
    }
  }

  console.log('\n' + '='.repeat(100));
}

function generateRecommendations(
  results: BenchmarkResult[]
): Record<string, string[]> {
  const recommendations: Record<string, string[]> = {
    workflow_control: [],
    tool_calling: [],
    conversational: [],
  };

  for (const useCase of Object.keys(recommendations)) {
    const useCaseResults = results.filter(
      (r) => r.useCase === useCase && r.success
    );
    const modelScores: Record<string, { tps: number; successRate: number }> =
      {};

    for (const r of useCaseResults) {
      if (!modelScores[r.model]) {
        modelScores[r.model] = { tps: 0, successRate: 0 };
      }
      modelScores[r.model].tps += r.tps || 0;
    }

    const sorted = Object.entries(modelScores)
      .map(([model, scores]) => ({ model, avgTps: scores.tps }))
      .sort((a, b) => b.avgTps - a.avgTps)
      .slice(0, 3)
      .map((m) => m.model);

    recommendations[useCase] = sorted;
  }

  return recommendations;
}

function saveResults(
  screened: ScreenedModel[],
  results: BenchmarkResult[],
  hardware: HardwareInfo,
  outputPath: string
) {
  const recommendations = generateRecommendations(results);

  const output = {
    timestamp: new Date().toISOString(),
    hardware: {
      gpus: hardware.gpus,
      ollamaHost: hardware.ollamaHost,
      ollamaPort: hardware.ollamaPort,
      cudaVisibleDevices: hardware.cudaVisibleDevices,
    },
    screenedModels: screened.map((m) => ({
      name: m.name,
      parameterSizeB: m.parameterSizeB,
      quantization: m.quantization,
      estimatedVRAMMB: m.estimatedVRAMMB,
      totalVRAMMB: m.totalVRAMMB,
      fitScore: m.fitScore,
      suitability: m.suitability,
    })),
    benchmarks: results.map((r) => ({
      model: r.model,
      useCase: r.useCase,
      scenario: r.scenario,
      success: r.success,
      tps: r.tps,
      latencyMs: r.latencyMs,
      responseLength: r.responseLength,
      validationDetails: r.validationDetails,
      error: r.error,
    })),
    recommendations,
  };

  const fullPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath);

  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, JSON.stringify(output, null, 2));
  console.log(`\n📁 Results saved to: ${fullPath}`);
}

function parseArgs(): BenchmarkConfig {
  const args = process.argv.slice(2);
  const config: BenchmarkConfig = {
    ollamaHost: process.env.OLLAMA_HOST || 'localhost',
    ollamaPort: parseInt(process.env.OLLAMA_PORT || '11434'),
    cudaVisibleDevices: process.env.CUDA_VISIBLE_DEVICES,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(`
Ollama Model Screener & Benchmark

Usage: npx tsx scripts/ollama-model-screener.ts [options]

Options:
  --host <host>           Ollama server host (default: localhost)
  --port <port>           Ollama server port (default: 11434)
  --cuda <devices>        CUDA visible devices (default: from env)
  --max-vram <gb>         Maximum VRAM per GPU in GB
  --quantizations <q1,q2>  Filter by quantization (e.g., Q4_K_M,Q5_K_M)
  --families <f1,f2>       Filter by family (e.g., llama,qwen,gemma)
  --exclude <f1,f2>       Exclude families (e.g., deepseek)
  --benchmark             Run benchmarks on screened models
  --output <path>         Output file path (default: ollama-screener-results.json)
  --help                  Show this help

Environment Variables:
  OLLAMA_HOST            Ollama server host
  OLLAMA_PORT            Ollama server port
  CUDA_VISIBLE_DEVICES   GPU device selection

Examples:
  # Screen models for 8GB VRAM constraint
  npx tsx scripts/ollama-model-screener.ts --max-vram 8

  # Screen + run benchmarks, save to custom location
  npx tsx scripts/ollama-model-screener.ts --max-vram 8 --benchmark --output results.json

  # Filter by quantization and family
  npx tsx scripts/ollama-model-screener.ts --quantizations Q4_K_M --families llama,qwen
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
    }
  }

  if (!config.output) {
    config.output = 'ollama-screener-results.json';
  }

  return config;
}

async function main() {
  console.log('🔍 Ollama Model Screener & Benchmark');
  console.log('='.repeat(50));

  const config = parseArgs();

  console.log('\n📋 Configuration:');
  console.log(`  Ollama: ${config.ollamaHost}:${config.ollamaPort}`);
  if (config.cudaVisibleDevices) {
    console.log(`  CUDA Devices: ${config.cudaVisibleDevices}`);
  }
  if (config.maxVRAMGB) {
    console.log(`  Max VRAM: ${config.maxVRAMGB}GB`);
  }
  if (config.quantizations?.length) {
    console.log(`  Quantizations: ${config.quantizations.join(', ')}`);
  }
  if (config.families?.length) {
    console.log(`  Families: ${config.families.join(', ')}`);
  }

  console.log('\n🖥️  Detecting hardware...');
  const hardware = await detectHardware();

  console.log('\n📦 Fetching available models...');
  const models = await fetchAvailableModels(
    config.ollamaHost,
    config.ollamaPort
  );
  console.log(`  Found ${models.length} models`);

  console.log('\n🔎 Screening models...');
  const screened = screenModels(models, hardware, config);
  console.log(`  ${screened.length} models passed screening`);

  if (screened.length === 0) {
    console.log('\n⚠️  No models matched your criteria');
    saveResults([], [], hardware, config.output!);
    return;
  }

  let benchmarkResults: BenchmarkResult[] = [];

  if (config.benchmark) {
    const modelNames = screened.slice(0, 10).map((m) => m.name);
    benchmarkResults = await runBenchmarks(modelNames, hardware);
  }

  printResultsTable(screened, benchmarkResults, hardware);
  saveResults(screened, benchmarkResults, hardware, config.output!);

  if (config.benchmark) {
    const recommendations = generateRecommendations(benchmarkResults);
    console.log('\n🎯 Recommendations by Use Case:');
    for (const [useCase, models] of Object.entries(recommendations)) {
      if (models.length > 0) {
        const labels: Record<string, string> = {
          workflow_control: '🔍 Workflow Control',
          tool_calling: '🔧 Tool Calling',
          conversational: '💬 Conversational',
        };
        console.log(`  ${labels[useCase]}: ${models.join(' > ')}`);
      }
    }
  }

  console.log('\n✅ Done!');
}

main().catch((error) => {
  console.error('Screener failed:', error);
  process.exit(1);
});
