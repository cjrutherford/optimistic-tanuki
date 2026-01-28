/**
 * OLLAMA 8GB VRAM BENCHMARK SUITE (Native Fetch Version)
 * ------------------------------------------------------
 * Target Hardware: NVIDIA RTX 5060 (8GB)
 * Focus: Speed (Tokens/s), Workflow (JSON), and Tool Use.
 */

const OLLAMA_HOST = 'http://192.168.50.14:11434';

// --- 1. The "Discovery" List ---
// These are larger models specifically quantized to fit ~8GB VRAM.
// We test standard models, but HIGHLY recommend pulling these specific tags.
const DISCOVERY_RECOMMENDATIONS = [
  { name: "gemma3:4b", desc: "Google's latest. 12B fits TIGHTLY in 8GB. Expect minor offloading." },
  { name: "mistral-nemo:12b-instruct-2407-q3_K_M", desc: "NVIDIA's 12B. Fits 8GB perfectly. Great at context." },
  { name: "nemotron-mini:4b", desc: "NVIDIA's Edge model. High precision, super fast." },
  { name: "qwen2.5:14b-instruct-q3_K_S", desc: "14B logic compressed to ~7GB. Better reasoning than any 8B." },
  { name: "phi3:14b-medium-128k-instruct-q2_K", desc: "Running at full precision (FP16) because it's so small." },
  { name: "deepseek-r1:8b", desc: "Best-in-class reasoning/math for this size category." },
];

// --- 2. Configuration ---
const CANDIDATES = [
  "gemma3:latest",     // The new standard (Check if 4B or 12B pulls by default)
  "gemma3n:latest",    // Mobile/Nano optimized (Fastest?)
  "llama3.1:latest",   // The Baseline
  "qwen2.5:7b",        // Logic/Coding Speedster
  "deepseek-r1:8b"     // New Reasoning King
];

// --- 3. Test Payloads ---
const TESTS = {
  conversation: {
    model: "",
    messages: [{ role: "user", content: "Describe a futuristic city in one vivid sentence." }],
    stream: false
  },
  workflow: {
    model: "",
    messages: [{ role: "user", content: "Return this data as JSON: {name: 'Kai', id: 5}." }],
    format: "json",
    stream: false
  },
  tools: {
    model: "",
    messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
    stream: false,
    tools: [{
      type: "function",
      function: {
        name: "get_weather",
        description: "Get weather for a location",
        parameters: {
          type: "object",
          properties: { location: { type: "string" } },
          required: ["location"]
        }
      }
    }]
  }
};

// --- 4. Helper Functions ---

async function apiRequest(endpoint, payload) {
  try {
    const response = await fetch(`${OLLAMA_HOST}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return await response.json();
  } catch (e) {
    return { error: e.message };
  }
}

async function checkAndPull(modelName) {
  // Check if exists
  try {
    const listRes = await fetch(`${OLLAMA_HOST}/api/tags`);
    const listData = await listRes.json();
    const exists = listData.models.some(m => m.name.includes(modelName));

    if (!exists) {
      process.stdout.write(`📥 Pulling ${modelName} (This may take time)...\n`);
      // Trigger pull (this can be slow, normally you'd stream the progress)
      const pullRes = await fetch(`${OLLAMA_HOST}/api/pull`, {
        method: 'POST',
        body: JSON.stringify({ name: modelName, stream: false })
      });
      if (!pullRes.ok) throw new Error("Pull failed");
      console.log(`✅ Pulled ${modelName}`);
    }
  } catch (e) {
    console.error(`⚠️ Could not verify/pull ${modelName}:`, e.message);
  }
}

function formatResult(model, task, tps, note) {
  console.log(`| ${model.padEnd(20)} | ${task.padEnd(12)} | ${tps.padEnd(6)} | ${note}`);
}

// --- 5. Main Execution ---

async function runSuite() {
  console.log(`\n🔎 DISCOVERY: Recommended High-Yield Models for 8GB VRAM`);
  console.table(DISCOVERY_RECOMMENDATIONS);

  console.log("\n🚀 STARTING BENCHMARK...");
  console.log(`| ${"MODEL".padEnd(20)} | ${"TASK".padEnd(12)} | ${"T/S".padEnd(6)} | RESULT`);
  console.log("|" + "-".repeat(60) + "|");

  for (const model of DISCOVERY_RECOMMENDATIONS.map(m => m.name)) {
    await checkAndPull(model);

    // -- TASK 1: CONVERSATION (Speed) --
    const start = performance.now();
    const chatRes = await apiRequest('/api/chat', { ...TESTS.conversation, model });

    if (chatRes.error) {
      formatResult(model, "Conv", "ERR", chatRes.error);
      continue;
    }

    const durationSec = (performance.now() - start) / 1000;
    // Eval count / eval duration is more accurate if provided by API, else calc manually
    const tps = (chatRes.eval_count / (chatRes.eval_duration / 1e9)).toFixed(1);
    formatResult(model, "Conversation", tps, "Success");

    // -- TASK 2: WORKFLOW (JSON) --
    const jsonRes = await apiRequest('/api/chat', { ...TESTS.workflow, model });
    let jsonStatus = "❌ Fail";
    try {
      JSON.parse(jsonRes.message.content);
      jsonStatus = "✅ Valid";
    } catch (e) { }
    formatResult(model, "Workflow", "--", jsonStatus);

    // -- TASK 3: TOOLS --
    // Note: Not all models support tools. This checks if they try.
    const toolRes = await apiRequest('/api/chat', { ...TESTS.tools, model });
    let toolStatus = "❌ No Call";
    if (toolRes.message && toolRes.message.tool_calls && toolRes.message.tool_calls.length > 0) {
      toolStatus = `✅ ${toolRes.message.tool_calls[0].function.name}`;
    }
    formatResult(model, "Tools", "--", toolStatus);

    console.log("|" + "-".repeat(60) + "|");
  }
}

runSuite();
