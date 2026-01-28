#!/usr/bin/env node
/**
 * Lightweight benchmark runner that queries an Ollama-compatible endpoint
 * for available models and runs a small prompt set against each model.
 *
 * Usage:
 *   node scripts/benchmark-models.js [ollamaBaseUrl]
 *
 * Defaults to http://localhost:11434 if no arg provided.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ollamaBase = process.argv[2] || process.env.OLLAMA_BASE || 'http://localhost:11434';

// Optional comma-separated filter of model name substrings (e.g. "deepseek,qwen,llama")
// Include 'nemotron' by default per request.
const MODEL_FILTER = (process.argv[3] || process.env.MODEL_FILTER || 'gpt-oss,deepseek,qwen,llama,gemma,nemotron').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const RESULTS_FILE = path.resolve('benchmark-results.json');
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '600000', 10); // per-request timeout (default 10m)
const TOTAL_TIMEOUT_MS = parseInt(process.env.TOTAL_TIMEOUT_MS || '900000', 10); // per-call total cap including continues (default 15m)
const MAX_CONTINUES = parseInt(process.env.MAX_CONTINUES || '5', 10);

const PROMPT_SET = [
  { id: 'tool-1', prompt: 'Create a task called "Update homepage" in the project "Website Redesign" and assign it to me.', needTool: true },
  { id: 'chat-1', prompt: 'Summarize the following project in two sentences: We are building an MVP to help manage personal goals.', needTool: false },
  { id: 'ambig-1', prompt: 'What is the status of our project and should we add more team members?', needTool: 'ambiguous' },
];

async function loadAvailableModels() {
  try {
    const res = await axios.get(`${ollamaBase}/api/tags`, { timeout: 10000 });
    const all = (res.data.models || []).filter((m) => !String(m.name).toLowerCase().includes('magicoder'));
    // Apply requested filter
    const filtered = all.filter((m) => MODEL_FILTER.some((p) => String(m.name).toLowerCase().includes(p)));
    return filtered.length > 0 ? filtered : all;
  } catch (e) {
    console.error('Failed to load models from', ollamaBase, e.message);
    return [];
  }
}

async function runOne(model, item) {
  const baseMessages = [
    { role: 'system', content: 'You are an assistant that follows instructions.' },
    { role: 'user', content: item.prompt },
  ];

  const start = Date.now();
  const timings = [];
  let lastContent = '';
  let error = null;
  let continues = 0;

  const isThinking = (text) => {
    if (!text) return false;
    const t = String(text).trim();
    // common indicators the model hasn't finished or is 'thinking'
    return /\[thinking\]|\bthinking\b|\bprocessing\b|\.{3,}$|\.\.\.$/i.test(t);
  };

  try {
    // initial request
    const res = await axios.post(`${ollamaBase}/api/chat`, { model: model.name, stream: false, messages: baseMessages }, { timeout: REQUEST_TIMEOUT_MS });
    const ms = Date.now() - start;
    timings.push(ms);
    lastContent = res.data?.message?.content || res.data?.content || JSON.stringify(res.data);

    // If model appears to be 'thinking', send continue requests up to MAX_CONTINUES
    let totalElapsed = Date.now() - start;
    while (isThinking(lastContent) && continues < MAX_CONTINUES && totalElapsed < TOTAL_TIMEOUT_MS) {
      continues += 1;
      // small backoff before asking to continue
      await new Promise((r) => setTimeout(r, 1000 * continues));
      const contMessages = [...baseMessages, { role: 'assistant', content: lastContent }, { role: 'user', content: 'Please continue the previous response.' }];
      const cres = await axios.post(`${ollamaBase}/api/chat`, { model: model.name, stream: false, messages: contMessages }, { timeout: REQUEST_TIMEOUT_MS });
      const cms = Date.now() - start - timings.reduce((a, b) => a + b, 0);
      timings.push(cms);
      lastContent = cres.data?.message?.content || cres.data?.content || JSON.stringify(cres.data);
      totalElapsed = Date.now() - start;
    }

    const totalMs = Date.now() - start;
    return { model: model.name, id: item.id, timeMs: totalMs, perAttemptMs: timings, continues, length: String(lastContent).length, response: lastContent };
  } catch (e) {
    const ms = Date.now() - start;
    error = e && e.message ? e.message : String(e);
    return { model: model.name, id: item.id, timeMs: ms, length: lastContent.length || 0, continues, error };
  }
}

(async () => {
  console.log('Loading available models from', ollamaBase);
  const models = await loadAvailableModels();
  if (!models || models.length === 0) {
    console.error('No models found. Make sure Ollama (or prompt-proxy) is reachable at', ollamaBase);
    process.exit(1);
  }
  console.log(`Found ${models.length} models. Running ${PROMPT_SET.length} prompts per model.`);

  const results = [];
  for (const m of models) {
    for (const p of PROMPT_SET) {
      console.log(`Running prompt ${p.id} on model ${m.name}...`);
      const out = await runOne(m, p);
      results.push(out);
      // Write intermediate results frequently
      fs.writeFileSync(path.resolve('benchmark-results.json'), JSON.stringify(results, null, 2), 'utf8');
    }
  }

  const finalFile = path.resolve('benchmark-results.json');
  fs.writeFileSync(finalFile, JSON.stringify(results, null, 2), 'utf8');
  console.log('Benchmark complete. Results written to', finalFile);
})();
