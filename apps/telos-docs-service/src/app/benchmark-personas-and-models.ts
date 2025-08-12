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
  const response = await axios.get('http://localhost:11434/api/tags');
  return response.data.models.filter((m) => !m.name.includes('magicoder'));
};

async function generateBenchmarkResults(model: any, personas: PersonaTelosDto[]) {
  const results = [];
  for (const persona of personas) {
    const prompt = await setupBenchmarkPrompt(persona, model.name);
    const preRequest = new Date();
    const response = await axios.post(
      'http://localhost:11434/api/chat',
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
      evaluations: [],
    });
  }
  return results;
}

async function evaluateResponses(model: any, results: any[]) {
  for (const r of results) {
    const {
      personaSystemPrompt,
      userPrompt,
      duration,
      response,
    } = r;
    const ratingPrompt = {
      model: model.name,
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert evaluator. Rate the following system prompt and response for informativeness, relevance, and clarity on a scale of 1 (poor) to 5 (excellent). Responses should take the form of { category : value }.',
        },
        {
          role: 'user',
          content: `Original System Prompt: ${personaSystemPrompt}\nUser Prompt: ${userPrompt}\nResponse: ${response}\nDuration: ${duration}`,
        },
      ],
    };
    const startTime = new Date();
    const result = await axios.post(
      'http://localhost:11434/api/chat',
      ratingPrompt
    );
    const endTime = new Date();
    const evaluationDuration = endTime.getTime() - startTime.getTime();
    console.log(
      `Rating for ${r.persona} with model ${r.model} took ${evaluationDuration} ms`
    );
    console.log(result.data);
    r.evaluations.push(result.data.message?.content || result.data.content);
  }
}

function writeResultsToCsv(results: any[], outputFile: string) {
  const header = 'persona,model,duration,response,evaluations\n';
  const rows = results
    .map(
      (r) =>
        `"${r.persona}","${r.model}",${r.duration},"${(
          r.response || ''
        ).replace(/"/g, '""')}","${(Array.isArray(r.evaluations) ? r.evaluations.join('\n\n\n') : r.evaluations || '').replace(/"/g, '""')}"`
    )
    .join('\n');
  fs.writeFileSync(path.resolve(outputFile), header + rows, 'utf8');
}

function readCsvResults(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').slice(1); // skip header
  return lines.filter(Boolean).map(line => line);
}

const main = async () => {
  const models = await loadAvailableModels();
  const personasArr = personas as PersonaTelosDto[];
  const modelCsvFiles: string[] = [];

  for (const model of models) {
    const results = await generateBenchmarkResults(model, personasArr);
    await evaluateResponses(model, results);
    const modelCsv = `${model.name}_results.csv`;
    writeResultsToCsv(results, modelCsv);
    modelCsvFiles.push(modelCsv);
    console.log(`Results for model ${model.name} written to ${modelCsv}`);
  }

  // After all models, combine into final CSV
  const finalCsv = process.argv[2] || 'results.csv';
  const header = 'persona,model,duration,response,evaluations\n';
  let allRows: string[] = [];
  for (const csvFile of modelCsvFiles) {
    allRows = allRows.concat(readCsvResults(csvFile));
  }
  fs.writeFileSync(path.resolve(finalCsv), header + allRows.join('\n'), 'utf8');
  console.log(`Final combined results written to ${finalCsv}`);
};

main();
