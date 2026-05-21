import { PersonaTelosDto } from '@optimistic-tanuki/models';
import { personaTelosPrompt } from '@optimistic-tanuki/prompt-generation';
import personas from '../assets/personas.json';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

type StreamMetrics = {
  requestStartAt: number;
  firstTokenAt?: number;
  completedAt?: number;
  timeToFirstTokenMs?: number;
  timeToCompletionMs?: number;
};

type GpuInfo = {
  available: boolean;
  name?: string;
  memoryMiB?: number;
};

const setupBenchmarkPrompt = async (
  persona: PersonaTelosDto,
  model: string,
  stream = true,
  useGpu = true
) => {
  const prompt = personaTelosPrompt(persona, model, undefined, undefined, {
    stream,
  });
  // Encourage concise rationale instead of full chain-of-thought
  prompt.messages.unshift({
    role: 'system',
    content:
      'When responding, include a brief rationale summarizing your approach (not full chain-of-thought). Keep rationale concise. Return the final answer clearly.',
  });
  prompt.messages.push({
    role: 'user',
    content:
      "Hi there, I'm interested in learning more about your capabilities. Please tell me a bit about yourself and what you can do.",
  });

  // Request GPU usage if available (Ollama respects num_gpu)
  (prompt as any).options = {
    ...(prompt as any).options,
    num_gpu: useGpu ? 1 : 0,
  };

  return prompt;
};

const loadAvailableModels = async () => {
  const response = await axios.get('http://192.168.50.148:11434/api/tags');
  return response.data.models.filter((m: any) => !m.name.includes('magicoder'));
};

async function getModelDetails(modelName: string) {
  try {
    const res = await axios.post('http://192.168.50.148:11434/api/show', {
      name: modelName,
    });
    return res.data;
  } catch (e) {
    return undefined;
  }
}

function getGpuInfo(): GpuInfo {
  try {
    const result = spawnSync('nvidia-smi', [
      '--query-gpu=name,memory.total',
      '--format=csv,noheader,nounits',
    ], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout) {
      const line = result.stdout.trim().split('\n')[0];
      const [name, memory] = line.split(',').map((s) => s.trim());
      const memoryMiB = parseInt(memory, 10);
      return { available: true, name, memoryMiB };
    }
    return { available: false };
  } catch (e) {
    return { available: false };
  }
}

function estimateGpuViability(details: any, gpu: GpuInfo): 'likely' | 'unlikely' | 'unknown' {
  if (!gpu.available) return 'unknown';
  // Heuristic: if reported parameter size or file size fits under ~80% VRAM, assume likely
  const sizeBytes = details?.size || details?.model_info?.parameter_size_bytes;
  if (typeof sizeBytes === 'number' && gpu.memoryMiB) {
    const vramBytes = gpu.memoryMiB * 1024 * 1024;
    return sizeBytes < vramBytes * 0.8 ? 'likely' : 'unlikely';
  }
  return 'unknown';
}

async function postChatStreaming(prompt: any): Promise<{ content: string; metrics: StreamMetrics; meta?: any }> {
  const metrics: StreamMetrics = { requestStartAt: Date.now() };
  const res = await axios.post('http://192.168.50.148:11434/api/chat', prompt, {
    responseType: 'stream',
  });
  const stream = res.data as NodeJS.ReadableStream;
  let buffer = '';
  let content = '';
  let meta: any = undefined;

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed);
          if (metrics.firstTokenAt == null) metrics.firstTokenAt = Date.now();
          if (obj?.message?.content) content += obj.message.content;
          if (obj?.content) content += obj.content;
          if (obj?.done) {
            meta = obj;
          }
        } catch (err) {
          // Ignore non-JSON fragments
        }
      }
    });
    stream.on('end', () => {
      metrics.completedAt = Date.now();
      metrics.timeToFirstTokenMs = metrics.firstTokenAt ? (metrics.firstTokenAt - metrics.requestStartAt) : undefined;
      metrics.timeToCompletionMs = metrics.completedAt - metrics.requestStartAt;
      resolve({ content, metrics, meta });
    });
    stream.on('error', (err: any) => reject(err));
  });
}

function loadIntermediateResults(filePath: string): any[] {
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }
  return [];
}

async function generateBenchmarkResults(
  model: any,
  personas: PersonaTelosDto[],
  existingResults: any[]
) {
  const results = [];
  for (const persona of personas) {
    const existingResult = existingResults.find(
      (r) => r.persona === persona.name && r.model === model.name
    );
    if (existingResult) {
      console.log(
        `Skipping benchmark for ${persona.name} with model ${model.name} (already completed).`
      );
      results.push(existingResult);
      continue;
    }

    const gpuInfo = getGpuInfo();
    const details = await getModelDetails(model.name);
    const gpuViability = estimateGpuViability(details, gpuInfo);

    const prompt = await setupBenchmarkPrompt(persona, model.name, true, gpuInfo.available);
    const { content, metrics, meta } = await postChatStreaming(prompt);

    console.log(
      `Response for ${persona.name} with model ${model.name} — first token: ${metrics.timeToFirstTokenMs} ms, completion: ${metrics.timeToCompletionMs} ms`
    );
    if (meta) console.log('Chat meta:', meta);

    results.push({
      persona: persona.name,
      personaSystemPrompt: prompt.messages?.find((m: any) => m.role === 'system')?.content ?? prompt.messages[0]?.content,
      userPrompt: prompt.messages?.find((m: any) => m.role === 'user')?.content ?? prompt.messages[1]?.content,
      model: model.name,
      timeToFirstTokenMs: metrics.timeToFirstTokenMs,
      timeToCompletionMs: metrics.timeToCompletionMs,
      gpuRequested: gpuInfo.available,
      gpuInfo,
      modelDetails: details,
      gpuViabilityEstimate: gpuViability,
      response: content,
      evaluations: [],
    });
  }
  return results;
}

async function evaluateResponses(
  results: any[],
  models: any[],
  existingResults: any[]
) {
  for (const evaluationModel of models) {
    for (const r of results) {
      const existingEvaluation = r.evaluations.find(
        (e: any) => e.model === evaluationModel.name
      );
      if (existingEvaluation) {
        console.log(
          `Skipping evaluation for ${r.persona} with model ${r.model} on ${evaluationModel.name} (already completed).`
        );
        continue;
      }

      const { personaSystemPrompt, userPrompt, timeToCompletionMs, response } = r;
      const ratingPrompt = {
        model: evaluationModel.name,
        stream: false,
        format: 'json',
        messages: [
          {
            role: 'system',
            content: `You are an expert evaluator. You are simply interested in scoring the response. 
              Rate the user input as a system prompt and response.
              The goal of the evaluation is to assess the quality of the response based on the model's system prompt and the user's input.
              Our categories of interest are informativeness, relevance, and clarity on a scale of 1 (poor) to 10 (excellent). 
              Responses should be solely json and the key should be the category and the value should be the score.
              `,
          },
          {
            role: 'user',
            content: `Original System Prompt: ${personaSystemPrompt}\nUser Prompt: ${userPrompt}\nResponse: ${response}\nDuration: ${timeToCompletionMs}ms`,
          },
        ],
      };
      const startTime = new Date();
      const result = await axios.post(
        'http://192.168.50.148:11434/api/chat',
        ratingPrompt
      );
      const endTime = new Date();
      const evaluationDuration = endTime.getTime() - startTime.getTime();
      console.log(
        `Rating for ${r.persona} with model ${r.model} on ${evaluationModel.name} took ${evaluationDuration} ms`
      );
      console.log(result.data);
      // Parse structured JSON if available
      let scores: any = undefined;
      try {
        const content = result.data.message?.content || result.data.content;
        scores = JSON.parse(content);
      } catch (e) {
        // keep raw content if parsing fails
      }
      const evaluationEntry: any = {
        model: evaluationModel.name,
        duration: evaluationDuration,
      };
      if (scores && typeof scores === 'object') {
        evaluationEntry.scores = scores;
        const values = Object.values(scores).filter((v) => typeof v === 'number') as number[];
        if (values.length) {
          evaluationEntry.averageScore = values.reduce((a, b) => a + b, 0) / values.length;
        }
      } else {
        evaluationEntry.content = result.data.message?.content || result.data.content;
      }
      r.evaluations.push(evaluationEntry);
    }
  }
}

function writeResultsToJson(results: any[], outputFile: string) {
  fs.writeFileSync(
    path.resolve(outputFile),
    JSON.stringify(results, null, 2),
    'utf8'
  );
}

const main = async () => {
  console.log('Loading available models...');
  const models = await loadAvailableModels();
  console.log(`Loaded ${models.length} models.`);

  const personasArr = personas as PersonaTelosDto[];
  console.log(`Loaded ${personasArr.length} personas.`);

  const intermediateJsonFile = 'intermediate_results.json';
  console.log(
    `Checking for existing intermediate results in ${intermediateJsonFile}...`
  );
  const allResults = loadIntermediateResults(intermediateJsonFile);
  console.log(`Loaded ${allResults.length} existing results.`);

  // Generate benchmark results for all models
  for (const model of models) {
    console.log(`Generating benchmark results for model: ${model.name}...`);
    const modelResults = await generateBenchmarkResults(
      model,
      personasArr,
      allResults
    );
    allResults.push(...modelResults);
    console.log(`Completed benchmark results for model: ${model.name}.`);
    writeResultsToJson(allResults, intermediateJsonFile); // Save intermediate results to JSON
    console.log(`Intermediate results saved to ${intermediateJsonFile}.`);
  }

  // Evaluate responses for all results
  console.log('Starting evaluation of responses...');
  await evaluateResponses(allResults, models, allResults);
  console.log('Completed evaluation of responses.');
  writeResultsToJson(allResults, intermediateJsonFile); // Save intermediate results after evaluations
  console.log(
    `Intermediate results after evaluations saved to ${intermediateJsonFile}.`
  );

  // Save all results to a single JSON file
  const finalJson = process.argv[2] || 'final_results.json';
  console.log(`Writing final results to JSON: ${finalJson}...`);
  writeResultsToJson(allResults, finalJson);
  console.log(`Final combined results written to ${finalJson}.`);
};

main();
