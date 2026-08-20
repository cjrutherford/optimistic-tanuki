#!/usr/bin/env node
/**
 * Pilot candidate Ollama models against the onboarding prompts that actually
 * matter to Opportunity Compass, and score them on the things that broke:
 *
 *  - schema conformance   — does schema-constrained decoding really hold?
 *  - question variety     — the original flow asked every user the same four
 *                           questions; a model that collapses to one question
 *                           across different profiles reintroduces that bug
 *  - grounding            — does the question reference the person's own work?
 *  - self-report avoidance— DISC questions must ask for past behaviour, not
 *                           "how would you describe yourself"
 *  - assessment sanity    — does primaryType match the highest quadrant score?
 *  - latency              — interview turns are interactive
 *
 * Usage:
 *   node tools/scripts/pilot-onboarding-models.mjs [--host H] [--pull] [--json out.json]
 */

const args = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
};

const HOST = flag('host', process.env.OLLAMA_HOST || '192.168.50.191:11434');
const BASE = HOST.startsWith('http') ? HOST : `http://${HOST}`;
const SHOULD_PULL = Boolean(flag('pull', false));
const JSON_OUT = flag('json', null);
// Re-run a single candidate by substring — model loads on this host can take
// over a minute, so re-testing one model should not mean re-testing ten.
const ONLY = flag('only', null);

/**
 * Candidates sized to leave KV-cache headroom on an 8 GB card.
 *
 * `family: 'vendor'` are first-party releases from the Ollama library.
 * `family: 'distill'` are community GGUFs on Hugging Face trained on frontier
 * model outputs. Note that distilling Claude or GPT outputs is contrary to
 * Anthropic's and OpenAI's usage policies — see the plan doc before shipping
 * one of these in a commercial deployment.
 */
const CANDIDATES = [
  // First-party
  {
    model: 'qwen3.5:4b-q8_0',
    size: '5.3GB',
    ctx: '256K',
    family: 'vendor',
    note: 'Qwen 3.5, 8-bit — least quant damage',
  },
  {
    model: 'qwen3:8b',
    size: '5.2GB',
    ctx: '40K',
    family: 'vendor',
    note: 'More parameters, heavier quant',
  },
  {
    model: 'granite4:tiny-h',
    size: '4.2GB',
    ctx: '1M',
    family: 'vendor',
    note: 'IBM, tuned for instruction following + JSON',
  },
  {
    model: 'gemma4:e2b-it-qat',
    size: '4.3GB',
    ctx: '128K',
    family: 'vendor',
    note: "Google's own quantization-aware build",
  },
  {
    model: 'nemotron-3-nano:4b-q8_0',
    size: '4.2GB',
    ctx: '256K',
    family: 'vendor',
    note: 'NVIDIA, trained on structured output',
  },
  // Distilled from proprietary API outputs — strong, but see the ToS note above.
  {
    model:
      'hf.co/Jackrong/Qwen3.5-4B-Claude-4.6-Opus-Reasoning-Distilled-GGUF:Q4_K_M',
    size: '2.7GB',
    ctx: '256K',
    family: 'api-distill',
    note: 'Opus 4.6 reasoning distill onto Qwen3.5-4B',
  },
  {
    model: 'hf.co/Jackrong/GPT-5-Distill-Qwen3-4B-Instruct-GGUF:Q4_K_S',
    size: '2.4GB',
    ctx: '256K',
    family: 'api-distill',
    note: 'GPT-5 distill, instruct not reasoning',
  },
  {
    model: 'hf.co/TeichAI/Qwen3-8B-GPT-5.2-High-Reasoning-Distill-GGUF:Q4_K_M',
    size: '5.0GB',
    ctx: '40K',
    family: 'api-distill',
    note: 'GPT-5.2 reasoning distill onto Qwen3-8B',
  },
  // Distilled from OPEN-WEIGHT teachers: the licence chain permits distillation
  // end to end, so these carry none of the exposure the api-distill row does.
  {
    model:
      'hf.co/mradermacher/gpt-oss-120b-Distill-Qwen3-4B-Thinking-i1-GGUF:i1-Q4_K_M',
    size: '2.5GB',
    ctx: '256K',
    family: 'open-distill',
    note: 'gpt-oss-120b (Apache-2.0) → Qwen3-4B (Apache-2.0). Fully Apache-2.0',
  },
  {
    model: 'hf.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF:Q4_K_M',
    size: '4.7GB',
    ctx: '128K',
    family: 'open-distill',
    note: 'DeepSeek-R1 → Qwen-7B, MIT; the most validated distill of the set',
  },
];

const DISC_DIMENSIONS = ['D', 'I', 'S', 'C'];

const QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    targetDimension: { type: 'string', enum: DISC_DIMENSIONS },
    sufficientSignal: { type: 'boolean' },
  },
  required: ['question', 'targetDimension', 'sufficientSignal'],
};

const ASSESSMENT_SCHEMA = {
  type: 'object',
  properties: {
    dScore: { type: 'number' },
    iScore: { type: 'number' },
    sScore: { type: 'number' },
    cScore: { type: 'number' },
    primaryType: { type: 'string', enum: DISC_DIMENSIONS },
    summary: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: [
    'dScore',
    'iScore',
    'sScore',
    'cScore',
    'primaryType',
    'summary',
    'confidence',
  ],
};

// Deliberately different people, so a model that ignores the profile shows up.
const PROFILES = [
  {
    serviceOffer: 'React modernization',
    industries: ['SaaS'],
    idealCustomer: 'VP Engineering at 50-200 person SaaS',
    skills: ['React', 'TypeScript'],
    terms: ['react', 'moderniz', 'frontend', 'saas', 'engineer'],
  },
  {
    serviceOffer: 'Executive coaching',
    industries: ['Healthcare'],
    idealCustomer: 'Clinical operations directors',
    skills: ['Facilitation', 'Leadership'],
    terms: ['coach', 'clinical', 'healthcare', 'leader', 'director'],
  },
  {
    serviceOffer: 'SEO and content strategy',
    industries: ['Ecommerce'],
    idealCustomer: 'Founders of DTC brands',
    skills: ['SEO', 'Analytics'],
    terms: ['seo', 'content', 'ecommerce', 'brand', 'founder', 'traffic'],
  },
  {
    serviceOffer: 'Fractional CFO services',
    industries: ['Finance'],
    idealCustomer: 'Seed-stage founders',
    skills: ['Forecasting', 'Fundraising'],
    terms: ['cfo', 'financ', 'forecast', 'fundrais', 'founder', 'runway'],
  },
  {
    serviceOffer: 'Industrial automation retrofits',
    industries: ['Manufacturing'],
    idealCustomer: 'Plant managers',
    skills: ['PLC', 'Robotics'],
    terms: ['automat', 'plant', 'manufactur', 'retrofit', 'machine', 'line'],
  },
];

const SYSTEM_PROMPT = `You are conducting a short behavioural interview to place someone on the DISC model.

DISC quadrants:
- D (Dominance): pace, control, decisiveness, appetite for confrontation
- I (Influence): persuasion, enthusiasm, relationship building
- S (Steadiness): consistency, patience, support, reaction to change
- C (Conscientiousness): precision, process, analysis, standards

Write ONE open question that draws out concrete behaviour — ask about a specific
past situation, never for self-description or self-rating. Ground it in the
person's own work and words so it could not have been asked of anyone else.
Never repeat a question already asked. Keep it under 40 words.

Set sufficientSignal to true only when the answers so far already reveal a clear
behavioural pattern across all four quadrants.`;

const TRANSCRIPT = [
  {
    role: 'assistant',
    text: 'Tell me about a recent decision you pushed through when others hesitated.',
  },
  {
    role: 'user',
    text: 'We were three weeks from a launch and the data model was wrong. I called it, we rewrote it over a weekend, and I took the heat for the slip.',
  },
  { role: 'assistant', text: 'How did you bring the team along?' },
  {
    role: 'user',
    text: 'I walked each lead through the numbers one on one before the group call, so nobody was blindsided.',
  },
];

// Phrasings that indicate the model asked for self-assessment rather than behaviour.
const SELF_REPORT = [
  'how would you describe yourself',
  'would you say you',
  'on a scale',
  'do you consider yourself',
  'rate yourself',
  'which of these best describes',
  'are you more of a',
  'how do you see yourself',
];

/**
 * Streamed so response headers arrive immediately. A non-streaming generate
 * sends no headers until the whole completion is done, which trips undici's
 * 300s headers timeout on a cold model load — the same failure that killed the
 * non-streaming pull.
 */
const chatJson = async (model, system, user, schema) => {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      format: schema,
      stream: true,
      think: false,
      options: { temperature: 0.3 },
    }),
  });

  if (!res.ok) {
    return {
      ok: false,
      ms: Date.now() - started,
      value: null,
      raw: `HTTP ${res.status}`,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let raw = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        raw += event?.message?.content ?? '';
      } catch {
        /* partial frame */
      }
    }
  }

  const ms = Date.now() - started;
  try {
    return { ok: true, ms, value: JSON.parse(raw), raw };
  } catch {
    return { ok: false, ms, value: null, raw };
  }
};

const describeProfile = (p) => `Sells: ${p.serviceOffer}
Ideal customer: ${p.idealCustomer}
Industries: ${p.industries.join(', ')}
Skills: ${p.skills.join(', ')}`;

const listModels = async () => {
  const res = await fetch(`${BASE}/api/tags`).then((r) => r.json());
  return new Set((res.models || []).map((m) => m.name));
};

/**
 * Streams pull progress. A non-streaming pull of a multi-GB model looks
 * identical to a hung one for many minutes, which makes a stalled run
 * impossible to distinguish from a slow one.
 */
const pull = async (model) => {
  console.log(`  pulling ${shortLabel(model)} …`);
  const res = await fetch(`${BASE}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: true }),
  });
  if (!res.ok) {
    console.log(`    failed (HTTP ${res.status})`);
    return false;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastLogged = 0;
  let failure = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.error) failure = event.error;
      const now = Date.now();
      if (event.total && event.completed && now - lastLogged > 15000) {
        lastLogged = now;
        const donePct = Math.round((event.completed / event.total) * 100);
        console.log(
          `    ${event.status || 'downloading'} ${donePct}% (${(
            event.completed / 1e9
          ).toFixed(1)}/${(event.total / 1e9).toFixed(1)} GB)`
        );
      }
    }
  }

  if (failure) {
    console.log(`    failed: ${failure}`);
    return false;
  }
  console.log('    pulled');
  return true;
};

const evaluate = async (candidate) => {
  const { model } = candidate;
  const result = {
    ...candidate,
    schemaOk: 0,
    schemaTotal: 0,
    latencies: [],
    questions: [],
    grounded: 0,
    selfReport: 0,
    assessmentSane: null,
    error: null,
  };

  try {
    // 1. One question per profile — variety and grounding.
    for (const profile of PROFILES) {
      const out = await chatJson(
        model,
        SYSTEM_PROMPT,
        `Their professional profile:\n${describeProfile(
          profile
        )}\n\nInterview so far:\n(nothing asked yet)\n\nQuadrants not yet probed: D, I, S, C\nPrefer a question targeting one of those.`,
        QUESTION_SCHEMA
      );
      result.schemaTotal++;
      result.latencies.push(out.ms);
      if (
        !out.ok ||
        typeof out.value?.question !== 'string' ||
        !DISC_DIMENSIONS.includes(out.value?.targetDimension)
      ) {
        continue;
      }
      result.schemaOk++;
      const q = out.value.question.trim();
      result.questions.push(q);
      const lower = q.toLowerCase();
      if (profile.terms.some((t) => lower.includes(t))) result.grounded++;
      if (SELF_REPORT.some((p) => lower.includes(p))) result.selfReport++;
    }

    // 2. Mid-interview turn — does it stay coherent with prior answers?
    const mid = await chatJson(
      model,
      SYSTEM_PROMPT,
      `Their professional profile:\n${describeProfile(
        PROFILES[0]
      )}\n\nInterview so far:\n${TRANSCRIPT.map(
        (t) => `${t.role === 'assistant' ? 'INTERVIEWER' : 'THEM'}: ${t.text}`
      ).join(
        '\n'
      )}\n\nQuadrants not yet probed: S, C\nPrefer a question targeting one of those.`,
      QUESTION_SCHEMA
    );
    result.schemaTotal++;
    result.latencies.push(mid.ms);
    if (mid.ok && DISC_DIMENSIONS.includes(mid.value?.targetDimension)) {
      result.schemaOk++;
      // It was told S and C remain; picking one of them is the correct behaviour.
      result.respectsCoverage = ['S', 'C'].includes(mid.value.targetDimension);
    }

    // 3. Assessment sanity — primaryType must be the top-scoring quadrant.
    const assess = await chatJson(
      model,
      'You score a DISC personality interview. Return balanced scores.',
      `Assess this transcript:\n${TRANSCRIPT.map(
        (t) => `${t.role.toUpperCase()}: ${t.text}`
      ).join('\n')}`,
      ASSESSMENT_SCHEMA
    );
    result.schemaTotal++;
    result.latencies.push(assess.ms);
    if (assess.ok && assess.value) {
      result.schemaOk++;
      const v = assess.value;
      const scores = { D: v.dScore, I: v.iScore, S: v.sScore, C: v.cScore };
      const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
      result.assessmentSane = top === v.primaryType;
    }
  } catch (error) {
    result.error = error.message;
  }

  return result;
};

/** hf.co/Org/Some-Long-Repo-GGUF:Q4_K_M -> Some-Long-Repo:Q4_K_M, trimmed. */
const shortLabel = (model) => {
  if (!model.startsWith('hf.co/')) return model;
  const [repo, tag] = model.slice('hf.co/'.length).split(':');
  const name = repo
    .split('/')
    .pop()
    .replace(/-GGUF$/i, '');
  const short = name.length > 24 ? `${name.slice(0, 23)}…` : name;
  return `${short}:${tag}`;
};

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const main = async () => {
  console.log(`\nOllama host: ${BASE}`);
  let installed;
  try {
    installed = await listModels();
  } catch (error) {
    console.error(`\nCannot reach Ollama at ${BASE}: ${error.message}`);
    process.exit(1);
  }
  console.log(
    `Installed models: ${
      installed.size ? [...installed].join(', ') : '(none)'
    }\n`
  );

  const results = [];
  // Smallest first: the link to the Ollama host runs around 1.3 MB/s, so a
  // 40 GB roster takes hours. Ascending order means a usable comparison exists
  // early, and every model's scores are flushed to disk as it finishes rather
  // than only at the end.
  const ordered = [...CANDIDATES]
    .filter(
      (candidate) =>
        typeof ONLY !== 'string' ||
        candidate.model.toLowerCase().includes(ONLY.toLowerCase())
    )
    .sort((a, b) => parseFloat(a.size) - parseFloat(b.size));

  if (typeof ONLY === 'string' && !ordered.length) {
    console.error(`No candidate matched --only "${ONLY}"`);
    process.exit(1);
  }

  const flush = async () => {
    if (!JSON_OUT || typeof JSON_OUT !== 'string') return;
    const { writeFileSync } = await import('node:fs');
    writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
  };

  for (const candidate of ordered) {
    const present = [...installed].some(
      (m) => m === candidate.model || m === `${candidate.model}:latest`
    );
    if (!present) {
      if (!SHOULD_PULL) {
        console.log(
          `- ${candidate.model.padEnd(26)} not installed (re-run with --pull)`
        );
        results.push({ ...candidate, skipped: true });
        continue;
      }
      if (!(await pull(candidate.model))) {
        results.push({ ...candidate, skipped: true, error: 'pull failed' });
        continue;
      }
    }
    process.stdout.write(
      `- ${shortLabel(candidate.model).padEnd(32)} evaluating … `
    );
    const r = await evaluate(candidate);
    console.log(r.error ? `error: ${r.error}` : 'done');
    results.push(r);
    await flush();
  }

  const scored = results.filter((r) => !r.skipped && !r.error);

  console.log('\n' + '='.repeat(112));
  console.log(
    'MODEL                            KIND     SIZE    SCHEMA  DISTINCT  GROUNDED  SELF-RPT  COVER  ASSESS  MED-MS'
  );
  console.log('='.repeat(112));
  for (const r of scored) {
    const distinct = new Set(r.questions).size;
    console.log(
      shortLabel(r.model).padEnd(32),
      (r.family || 'vendor').padEnd(8),
      String(r.size).padEnd(7),
      `${pct(r.schemaOk, r.schemaTotal)}%`.padEnd(7),
      `${distinct}/${PROFILES.length}`.padEnd(9),
      `${pct(r.grounded, r.questions.length)}%`.padEnd(9),
      String(r.selfReport).padEnd(9),
      (r.respectsCoverage ? 'yes' : 'no').padEnd(6),
      (r.assessmentSane === null
        ? '-'
        : r.assessmentSane
        ? 'ok'
        : 'BAD'
      ).padEnd(7),
      String(median(r.latencies))
    );
  }
  console.log('='.repeat(112));
  console.log(`
SCHEMA    valid + enum-conformant JSON across ${
    scored[0]?.schemaTotal ?? 7
  } calls
DISTINCT  unique first questions across ${
    PROFILES.length
  } different people — low means it ignores the profile
GROUNDED  questions containing a term from that person's own work
SELF-RPT  questions asking for self-description instead of past behaviour (lower is better)
COVERAGE  honoured the "these quadrants remain" instruction
ASSESS    primaryType matches the highest quadrant score
MED-MS    median latency per call`);

  for (const r of scored) {
    console.log(`\n--- ${shortLabel(r.model)} sample questions ---`);
    r.questions.slice(0, 3).forEach((q) => console.log(`  • ${q}`));
  }

  await flush();
  if (JSON_OUT && typeof JSON_OUT === 'string') {
    console.log(`\nWrote ${JSON_OUT}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
