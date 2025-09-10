import { PersonaTelosDto } from '@optimistic-tanuki/models';
import { personaTelosPrompt } from '@optimistic-tanuki/prompt-generation';
import personas from '../assets/personas.json';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const setupBenchmarkPrompt = async (
  persona: PersonaTelosDto,
  model: string
) => {
  const prompt = personaTelosPrompt(persona, model, undefined, undefined, {
    stream: false,
  });
  prompt.messages.push({
    role: 'user',
    content:
      "Hi there, I'm interested in learning more about your capabilities. Please tell me a bit about yourself and what you can do.",
  });

  return prompt;
};

const loadAvailableModels = async () => {
  const response = await axios.get('http://192.168.50.148:11434/api/tags');
  return response.data.models.filter((m) => !m.name.includes('magicoder'));
};

function loadIntermediateResults(filePath: string): any[] {
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }
  return [];
}

async function generateBenchmarkResults(model: any, personas: PersonaTelosDto[], existingResults: any[]) {
  const results = [];
  for (const persona of personas) {
    const existingResult = existingResults.find(
      (r) => r.persona === persona.name && r.model === model.name
    );
    if (existingResult) {
      console.log(`Skipping benchmark for ${persona.name} with model ${model.name} (already completed).`);
      results.push(existingResult);
      continue;
    }

    const prompt = await setupBenchmarkPrompt(persona, model.name);
    const preRequest = new Date();
    const response = await axios.post(
      'http://192.168.50.148:11434/api/chat',
      prompt
    );
    const postResponse = new Date();
    const duration = postResponse.getTime() - preRequest.getTime();
    console.log(
      `Response for ${persona.name} with model ${model.name} took ${duration} ms`
    );
    console.log(response.data);

    results.push({
      persona: persona.name,
      personaSystemPrompt: prompt.messages[0].content,
      userPrompt: prompt.messages[1].content,
      model: model.name,
      duration,
      response: response.data.message.content,
      evaluations: [], // Placeholder for evaluations
    });
  }
  return results;
}

async function evaluateResponses(results: any[], models: any[], existingResults: any[]) {
  for (const evaluationModel of models) {
    for (const r of results) {
      const existingEvaluation = r.evaluations.find(
        (e: any) => e.model === evaluationModel.name
      );
      if (existingEvaluation) {
        console.log(`Skipping evaluation for ${r.persona} with model ${r.model} on ${evaluationModel.name} (already completed).`);
        continue;
      }

      const {
        personaSystemPrompt,
        userPrompt,
        duration,
        response,
      } = r;
      const ratingPrompt = {
        model: evaluationModel.name,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              `You are an expert evaluator. You are simply interested in scoring the response. 
              Rate the user input as a system prompt and response.
              The goal of the evaluation is to assess the quality of the response based on the model's system prompt and the user's input.
              Our categories of interest are informativeness, relevance, and clarity on a scale of 1 (poor) to 10 (excellent). 
              Responses should be solely json and the key should be the category and the value should be the score.
              `,
          },
          {
            role: 'user',
            content: `Original System Prompt: ${personaSystemPrompt}\nUser Prompt: ${userPrompt}\nResponse: ${response}\nDuration: ${duration}ms`,
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
      r.evaluations.push({
        model: evaluationModel.name,
        duration: evaluationDuration,
        content: result.data.message?.content || result.data.content,
      });
    }
  }
}

function writeResultsToJson(results: any[], outputFile: string) {
  fs.writeFileSync(path.resolve(outputFile), JSON.stringify(results, null, 2), 'utf8');
}

const main = async () => {
  console.log('Loading available models...');
  const models = await loadAvailableModels();
  console.log(`Loaded ${models.length} models.`);

  const personasArr = personas as PersonaTelosDto[];
  console.log(`Loaded ${personasArr.length} personas.`);

  const intermediateJsonFile = 'intermediate_results.json';
  console.log(`Checking for existing intermediate results in ${intermediateJsonFile}...`);
  const allResults = loadIntermediateResults(intermediateJsonFile);
  console.log(`Loaded ${allResults.length} existing results.`);

  // Generate benchmark results for all models
  for (const model of models) {
    console.log(`Generating benchmark results for model: ${model.name}...`);
    const modelResults = await generateBenchmarkResults(model, personasArr, allResults);
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
  console.log(`Intermediate results after evaluations saved to ${intermediateJsonFile}.`);

  // Save all results to a single JSON file
  const finalJson = process.argv[2] || 'final_results.json';
  console.log(`Writing final results to JSON: ${finalJson}...`);
  writeResultsToJson(allResults, finalJson);
  console.log(`Final combined results written to ${finalJson}.`);
};

main();
