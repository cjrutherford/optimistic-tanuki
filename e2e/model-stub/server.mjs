// A deterministic stand-in for the review model in the e2e stack (D28).
//
// civic-contributions asks its model to classify a submission and tells it
// the exact JSON shape to answer in: "Reply with JSON only, in exactly this
// shape:" followed by every question with `{ "answer": false, ... }`. This
// stub answers in that same shape with every answer false, which the review
// rules read as nothing to hold or reject. Anything it can't parse gets an
// empty object, which the rules treat as an unreadable reply (held).
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 3040);
const SHAPE_MARKER = 'in exactly this shape:';

function answerFor(messages) {
  const system = messages.find((message) => message.role === 'system');
  const content = typeof system?.content === 'string' ? system.content : '';
  const at = content.indexOf(SHAPE_MARKER);
  if (at < 0) return '{}';
  const shape = content
    .slice(at + SHAPE_MARKER.length)
    .trim()
    .split('\n')[0];
  try {
    const questions = JSON.parse(shape);
    return JSON.stringify(
      Object.fromEntries(
        Object.keys(questions).map((key) => [
          key,
          { answer: false, reason: 'e2e stub' },
        ])
      )
    );
  } catch {
    return '{}';
  }
}

createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200).end('ok');
    return;
  }
  if (
    request.method !== 'POST' ||
    !request.url?.endsWith('/chat/completions')
  ) {
    response.writeHead(404).end();
    return;
  }
  let body = '';
  request.on('data', (chunk) => (body += chunk));
  request.on('end', () => {
    let messages = [];
    let model = 'e2e-stub';
    try {
      const parsed = JSON.parse(body);
      messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      model = typeof parsed.model === 'string' ? parsed.model : model;
    } catch {
      // An unreadable request gets the unreadable answer below.
    }
    response.writeHead(200, { 'content-type': 'application/json' }).end(
      JSON.stringify({
        model,
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: answerFor(messages) },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      })
    );
  });
}).listen(PORT, () => console.log(`model stub listening on ${PORT}`));
