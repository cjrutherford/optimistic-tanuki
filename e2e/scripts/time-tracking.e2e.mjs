#!/usr/bin/env node
/**
 * Time tracking, against a running stack.
 *
 * Every check here was probed by hand first and every one of them failed. A
 * finished entry recorded zero seconds, because the app stopped a timer by
 * sending an end time and no duration and nothing derived one. A three minute
 * entry was made to claim forty hours, and then minus five hundred seconds,
 * because the column stored whatever a caller sent. Creating an entry was
 * refused without a start time that the service then threw away.
 *
 * The point of running it against the stack is that all of that passed its
 * unit tests. What was wrong lived in the space between the client, the DTO
 * and the service, and only a real request crosses all three.
 *
 *   node e2e/scripts/time-tracking.e2e.mjs
 */

const BASE = process.env.BASE ?? 'http://localhost:8081';
const EMAIL = process.env.EMAIL ?? 'fow2@example.com';
const PASSWORD = process.env.PASSWORD ?? 'Password123!';

let token;
const failures = [];

function check(name, condition, detail = '') {
  console.log(
    `${condition ? 'ok  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`
  );
  if (!condition) failures.push(name);
}

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-ot-appscope': 'forgeofwill',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(
      `${method} ${path} -> ${response.status} ${text.slice(0, 200)}`
    );
  }
  return parsed;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const login = await api('/authentication/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  token = login?.data?.newToken ?? login?.newToken;

  const project = (await api('/project-planning/projects'))[0];
  const task = project.tasks[0];
  console.log(`Project ${project.name}, task "${task.title}"\n`);

  // No start time goes with this. The server reads its own clock.
  const started = await api('/project-planning/task-time-entries', {
    method: 'POST',
    body: { taskId: task.id, description: 'e2e' },
  });
  check(
    'an entry can be started without inventing a start time',
    !!started?.id
  );

  await wait(3000);

  const stopped = await api(
    `/project-planning/task-time-entries/${started.id}/stop`,
    { method: 'PATCH' }
  );
  check(
    'stopping records the time that actually passed',
    stopped.elapsedSeconds >= 2 && stopped.elapsedSeconds <= 15,
    `${stopped.elapsedSeconds}s`
  );
  check('and it records when the work ended', !!stopped.endTime);

  const again = await api(
    `/project-planning/task-time-entries/${started.id}/stop`,
    { method: 'PATCH' }
  );
  check(
    'stopping twice does not stretch the entry',
    again.elapsedSeconds === stopped.elapsedSeconds,
    `${again.elapsedSeconds}s`
  );

  // The other way to stop one, which is what the app used to do.
  const second = await api('/project-planning/task-time-entries', {
    method: 'POST',
    body: { taskId: task.id, description: 'e2e update path' },
  });
  await wait(2000);
  const viaUpdate = await api('/project-planning/task-time-entries', {
    method: 'PATCH',
    body: { id: second.id, endTime: new Date().toISOString() },
  });
  check(
    'stopping through update records a duration too, rather than zero',
    viaUpdate.elapsedSeconds >= 1,
    `${viaUpdate.elapsedSeconds}s`
  );

  // A caller cannot say anything about the duration. The field is gone from
  // the DTO, so the request is refused rather than quietly ignored, which is
  // the difference between a rule and a hope.
  let refused = false;
  try {
    await api('/project-planning/task-time-entries', {
      method: 'PATCH',
      body: {
        id: second.id,
        elapsedSeconds: 144000,
        endTime: viaUpdate.endTime,
      },
    });
  } catch (error) {
    refused = /elapsedSeconds should not exist/.test(error.message);
  }
  check('a caller claiming forty hours is refused outright', refused);

  const untouched = await api(
    `/project-planning/task-time-entries/${second.id}`
  );
  check(
    'and the entry keeps the duration the server measured',
    untouched.elapsedSeconds === viaUpdate.elapsedSeconds,
    `${untouched.elapsedSeconds}s`
  );

  const entries = await api('/project-planning/task-time-entries/query', {
    method: 'POST',
    body: { projectId: project.id },
  });
  check(
    'the whole project can be read in one request',
    entries.length >= 2,
    `${entries.length} entries`
  );
  // Only what this run made. Rows written before the fix still carry the
  // nonsense they were given, and asserting over all of history would be
  // testing the database's past rather than the code's present.
  const mine = entries.filter((entry) =>
    [started.id, second.id].includes(entry.id)
  );
  check(
    'and every entry this run finished carries a real duration',
    mine.length === 2 && mine.every((entry) => entry.elapsedSeconds > 0),
    mine.map((entry) => `${entry.elapsedSeconds}s`).join(', ')
  );

  console.log(
    `\n${
      failures.length
        ? `${failures.length} FAILED: ${failures.join(', ')}`
        : 'all checks passed'
    }`
  );
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(`\nthe run could not finish: ${error.message}`);
  process.exit(2);
});
