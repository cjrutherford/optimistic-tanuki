#!/usr/bin/env node
/**
 * The whole path, against a running stack and a real model.
 *
 * Three things happen here that no unit test can reach.
 *
 * The agent asks a model what a project needs and files what it says, which is
 * the suggestion half. A person approves one, which has to produce the row it
 * described. And the agent is told to do something through the MCP server,
 * which on a gated project must file a proposal and say plainly that nothing
 * happened, then produce the row once a person agrees.
 *
 * Every claim is checked against the board rather than against what a service
 * returned. The failures this exists to catch all looked like success from the
 * caller's side: an approval that recorded a status and applied nothing, an
 * agent reporting work it had only proposed, payloads that could never save.
 *
 *   node e2e/scripts/approval-path.e2e.mjs
 *
 * Env: BASE (default http://localhost:8081), EMAIL, PASSWORD.
 */

const BASE = process.env.BASE ?? 'http://localhost:8081';
const EMAIL = process.env.EMAIL ?? 'fow2@example.com';
const PASSWORD = process.env.PASSWORD ?? 'Password123!';

let token;
const failures = [];

function check(name, condition, detail = '') {
  const mark = condition ? 'ok  ' : 'FAIL';
  console.log(`${mark} ${name}${detail ? `  ${detail}` : ''}`);
  if (!condition) failures.push(name);
  return condition;
}

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // The same header the client sends. Without it every request is a 403,
      // which reads like an authorisation problem and is not one.
      'x-ot-appscope': 'forgeofwill',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) {
    throw new Error(
      `${method} ${path} -> ${response.status} ${text.slice(0, 300)}`
    );
  }
  return parsed;
}

async function login() {
  const result = await api('/authentication/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  token = result?.data?.newToken ?? result?.newToken ?? result?.token;
  if (!token) throw new Error('No token came back from login');
}

/** The board as it stands, so a claim can be checked against it. */
async function board(projectId) {
  const project = await api(`/project-planning/projects/${projectId}`);
  return {
    tasks: project.tasks ?? [],
    risks: project.risks ?? [],
    journal: project.projectJournals ?? project.journals ?? [],
  };
}

async function pending(projectId) {
  const all = await api(`/project-planning/projects/${projectId}/ai-changes`);
  return all.filter((change) => change.status === 'PENDING');
}

async function main() {
  await login();
  console.log(`Signed in as ${EMAIL}`);

  const projects = await api('/project-planning/projects');
  const project = projects[0];
  if (!project) throw new Error('No project to work with');
  console.log(`Project: ${project.name} (${project.id})\n`);

  check(
    'the project requires approval, so the gate is in play',
    project.requireHumanApproval === true
  );

  // --- suggestion -------------------------------------------------------
  console.log('\n-- the assistant suggesting --');
  const before = await board(project.id);
  const suggested = await api(
    `/project-planning/projects/${project.id}/ai-proposals`,
    { method: 'POST' }
  );
  const filed = suggested.changes ?? [];
  check(
    'the model produced at least one suggestion',
    filed.length > 0,
    `${filed.length} filed by ${suggested.model}`
  );
  check(
    'every suggestion is waiting rather than done',
    filed.every((change) => change.status === 'PENDING' && !change.applied)
  );
  check(
    'every suggestion carries a reason a reviewer can read',
    filed.every((change) => !!change.reason?.trim())
  );

  const afterSuggesting = await board(project.id);
  check(
    'suggesting on its own changed nothing on the board',
    afterSuggesting.tasks.length === before.tasks.length &&
      afterSuggesting.risks.length === before.risks.length &&
      afterSuggesting.journal.length === before.journal.length
  );

  // --- approval ---------------------------------------------------------
  console.log('\n-- a person approving --');
  const toApprove = filed[0];
  const approved = await api(
    `/project-planning/projects/ai-changes/${toApprove.id}`,
    { method: 'PATCH', body: { status: 'APPROVED', reviewNote: 'e2e' } }
  );
  check(
    'approving carried the change out',
    approved.applied === true,
    approved.applyError ?? ''
  );
  check('it recorded what it made', !!approved.appliedEntityId);

  const afterApproving = await board(project.id);
  const rows = (b) => b.tasks.length + b.risks.length + b.journal.length;
  const grew = rows(afterApproving) - rows(afterSuggesting);

  // A create adds a row and an update changes one, so the count alone cannot
  // say whether the right thing happened. Now that updates can be proposed,
  // asserting growth for every operation checked the wrong fact.
  if (toApprove.operation.endsWith('.create')) {
    check(
      'approving a create added exactly one row',
      grew === 1,
      toApprove.operation
    );
  } else {
    const target = afterApproving.tasks.find(
      (task) => task.id === approved.appliedEntityId
    );
    check(
      'approving an update changed the row it named and added none',
      grew === 0 && !!target,
      toApprove.operation
    );
  }

  // --- rejection --------------------------------------------------------
  if (filed[1]) {
    console.log('\n-- a person rejecting --');
    await api(`/project-planning/projects/ai-changes/${filed[1].id}`, {
      method: 'PATCH',
      body: { status: 'REJECTED', reviewNote: 'e2e' },
    });
    const afterRejecting = await board(project.id);
    check(
      'rejecting wrote nothing',
      afterRejecting.tasks.length === afterApproving.tasks.length &&
        afterRejecting.risks.length === afterApproving.risks.length &&
        afterRejecting.journal.length === afterApproving.journal.length
    );
  }

  // --- the agent acting through MCP ------------------------------------
  console.log('\n-- the agent acting through the MCP server --');
  const title = `Confirm the kiln liner supplier ${Date.now()}`;
  const boardBeforeAgent = await board(project.id);
  const pendingBefore = await pending(project.id);

  const run = await api(`/project-planning/projects/${project.id}/ai-act`, {
    method: 'POST',
    body: { instruction: `Create a task called "${title}".` },
  });

  check(
    'the agent reached the MCP server and called a tool',
    (run.used ?? []).length > 0,
    (run.used ?? []).map((call) => call.tool).join(', ') ||
      run.unavailable ||
      ''
  );
  check(
    'the gate turned the tool call into a proposal',
    run.awaitingApproval === true
  );

  const boardAfterAgent = await board(project.id);
  check(
    'the agent wrote nothing to the board',
    boardAfterAgent.tasks.length === boardBeforeAgent.tasks.length
  );

  const pendingAfter = await pending(project.id);
  const fromAgent = pendingAfter.find(
    (change) =>
      !pendingBefore.some((earlier) => earlier.id === change.id) &&
      change.operation === 'task.create'
  );
  check('the agent left a proposal for a person', !!fromAgent);

  if (fromAgent) {
    console.log('\n-- approving what the agent proposed --');
    const done = await api(
      `/project-planning/projects/ai-changes/${fromAgent.id}`,
      { method: 'PATCH', body: { status: 'APPROVED', reviewNote: 'e2e' } }
    );
    check(
      "approving the agent's proposal created the task",
      done.applied === true,
      done.applyError ?? ''
    );

    const finalBoard = await board(project.id);
    const created = finalBoard.tasks.find(
      (task) => task.id === done.appliedEntityId
    );
    check(
      'the task the agent asked for is on the board',
      !!created,
      created?.title ?? ''
    );
    check(
      'and it is the one the agent named',
      created?.title?.includes('Confirm the kiln liner supplier') === true,
      created?.title ?? ''
    );
  }

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
