#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  resolveE2eLifecyclePhases,
  resolveE2eServices,
  resolveE2eTarget,
} from './e2e-environment-manifest.mjs';

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_INTERVAL_MS = 2_000;

function createRuntime() {
  return {
    run: async (command, args) => {
      const { stdout } = await execFileAsync(command, args, {
        encoding: 'utf8',
      });
      return stdout;
    },
    fetch: globalThis.fetch,
    now: () => Date.now(),
    sleep: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    info: (message) => process.stdout.write(`${message}\n`),
    error: (message) => process.stderr.write(`${message}\n`),
  };
}

function composeArgs(composeFiles, command, composeProject) {
  return [
    'compose',
    ...(composeProject ? ['--project-name', composeProject] : []),
    ...composeFiles.flatMap((composeFile) => ['-f', composeFile]),
    ...command,
  ];
}

function serviceName(row) {
  return row.Service ?? row.service ?? row.Name ?? row.name;
}

function exitCode(row) {
  const value = row.ExitCode ?? row.exitCode;
  if (value !== undefined && value !== '') return Number(value);
  const status = String(row.Status ?? row.status ?? '');
  const match = status.match(/exited\s*\((\d+)\)/i);
  return match ? Number(match[1]) : undefined;
}

function isExited(row) {
  const state = String(row.State ?? row.state ?? '').toLowerCase();
  const status = String(row.Status ?? row.status ?? '').toLowerCase();
  return state === 'exited' || status.includes('exited');
}

function isRunning(row) {
  const state = String(row.State ?? row.state ?? '').toLowerCase();
  const status = String(row.Status ?? row.status ?? '').toLowerCase();
  return state === 'running' || status.startsWith('up');
}

function healthState(row) {
  return String(row.Health ?? row.health ?? '').toLowerCase();
}

function hasHealthState(row) {
  return healthState(row).length > 0;
}

function isHealthy(row) {
  return healthState(row) === 'healthy';
}

export function parseComposePsJson(output) {
  const value = output.trim();
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return value
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}

async function readComposeStatus(options, runtime) {
  const output = await runtime.run(
    'docker',
    composeArgs(
      options.composeFiles,
      ['ps', '--all', '--format', 'json'],
      options.composeProject
    )
  );
  return parseComposePsJson(output);
}

async function reportDiagnostics(options, runtime) {
  runtime.error('E2E readiness failed; Compose status and recent logs follow.');
  const commands = [
    ['ps'],
    ['logs', '--tail', '100', ...options.requiredServices],
  ];
  for (const command of commands) {
    try {
      const output = await runtime.run(
        'docker',
        composeArgs(options.composeFiles, command, options.composeProject)
      );
      if (output) runtime.error(output.trim());
    } catch (error) {
      runtime.error(`Unable to collect Compose diagnostics: ${error.message}`);
    }
  }
}

function assertOptions(options) {
  if (
    !Array.isArray(options.composeFiles) ||
    options.composeFiles.length === 0
  ) {
    throw new Error('At least one --compose-file is required');
  }
  if (
    !Array.isArray(options.requiredServices) ||
    options.requiredServices.length === 0
  ) {
    throw new Error('At least one required service is required');
  }
  if (!Array.isArray(options.requiredUrls)) {
    throw new Error('Required HTTP URLs must be an array');
  }
  if (
    options.composeProject !== undefined &&
    typeof options.composeProject !== 'string'
  ) {
    throw new Error('Compose project must be a string');
  }
  if (
    options.completedServices !== undefined &&
    !Array.isArray(options.completedServices)
  ) {
    throw new Error('Completed services must be an array');
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be greater than zero');
  }
  if (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0) {
    throw new Error('--interval-ms must be greater than zero');
  }
}

async function probeUrls(requiredUrls, runtime, timeoutMs) {
  const probes = await Promise.all(
    requiredUrls.map(async (url) => {
      try {
        const response = await runtime.fetch(url, {
          signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
        });
        return response.ok ? null : `${url} returned HTTP ${response.status}`;
      } catch (error) {
        return `${url} is unavailable (${error.message})`;
      }
    })
  );
  return probes.filter(Boolean);
}

/**
 * Wait for a Compose stack to be ready for an E2E suite.
 * Runtime dependencies are injectable so unit tests do not require Docker.
 */
export async function waitForE2eReadiness(options, runtime = createRuntime()) {
  assertOptions(options);
  const deadline = runtime.now() + options.timeoutMs;
  const completedServices =
    options.completedServices ??
    (options.requiredServices.includes('db-setup') ? ['db-setup'] : []);
  const completedServiceSet = new Set(completedServices);
  let lastReason = 'services have not reported readiness';

  while (runtime.now() <= deadline) {
    try {
      const rows = await readComposeStatus(options, runtime);
      const services = new Map(rows.map((row) => [serviceName(row), row]));
      for (const service of completedServices) {
        const status = services.get(service);
        if (status && isExited(status) && exitCode(status) !== 0) {
          lastReason = `${service} exited unsuccessfully with code ${exitCode(
            status
          )}`;
          await reportDiagnostics(options, runtime);
          throw new Error(lastReason);
        }
        if (!status || !isExited(status) || exitCode(status) !== 0) {
          lastReason = `waiting for ${service} to exit successfully`;
          if (runtime.now() >= deadline) break;
          await runtime.sleep(
            Math.min(options.intervalMs, deadline - runtime.now())
          );
          break;
        }
      }

      if (
        completedServices.some((service) => {
          const status = services.get(service);
          return !status || !isExited(status) || exitCode(status) !== 0;
        })
      )
        continue;

      const unavailableServices = options.requiredServices.filter(
        (service) =>
          !completedServiceSet.has(service) &&
          !isRunning(services.get(service) ?? {})
      );
      if (unavailableServices.length > 0) {
        lastReason = `services not running: ${unavailableServices.join(', ')}`;
      } else {
        const unhealthyServices = options.requiredServices.filter((service) => {
          if (completedServiceSet.has(service)) return false;
          const status = services.get(service) ?? {};
          return hasHealthState(status) && !isHealthy(status);
        });
        if (unhealthyServices.length > 0) {
          lastReason = `services not healthy: ${unhealthyServices.join(', ')}`;
          if (runtime.now() >= deadline) break;
          await runtime.sleep(
            Math.min(options.intervalMs, deadline - runtime.now())
          );
          continue;
        }
        const failedUrls = await probeUrls(
          options.requiredUrls,
          runtime,
          Math.min(options.intervalMs, Math.max(1, deadline - runtime.now()))
        );
        if (failedUrls.length === 0) {
          const confirmation =
            options.requiredUrls.length > 0
              ? options.requiredUrls.join(', ')
              : options.requiredServices.join(', ');
          runtime.info(`E2E readiness confirmed for ${confirmation}`);
          return;
        }
        lastReason = failedUrls.join('; ');
      }
    } catch (error) {
      if (String(error.message).includes('exited unsuccessfully')) throw error;
      lastReason = `Compose status could not be read (${error.message})`;
    }

    if (runtime.now() >= deadline) break;
    await runtime.sleep(Math.min(options.intervalMs, deadline - runtime.now()));
  }

  await reportDiagnostics(options, runtime);
  throw new Error(`Timed out waiting for E2E readiness: ${lastReason}`);
}

export async function prepareRunner(
  runtime = createRuntime(),
  {
    allowGlobalPrune = process.env.GITHUB_ACTIONS === 'true' &&
      process.env.E2E_ALLOW_GITHUB_RUNNER_DOCKER_PRUNE === 'true',
  } = {}
) {
  runtime.info('Runner capacity before Docker cleanup:');
  runtime.info((await runtime.run('df', ['-h'])).trim());
  runtime.info((await runtime.run('docker', ['system', 'df'])).trim());
  if (!allowGlobalPrune) {
    runtime.info(
      'Skipping global Docker prune: explicit GitHub-runner authorization is required.'
    );
    return;
  }
  runtime.info(
    'Pruning unused Docker images, containers, networks, build cache, and volumes.'
  );
  runtime.info(
    (
      await runtime.run('docker', ['system', 'prune', '-af', '--volumes'])
    ).trim()
  );
  runtime.info('Runner capacity after Docker cleanup:');
  runtime.info((await runtime.run('df', ['-h'])).trim());
  runtime.info((await runtime.run('docker', ['system', 'df'])).trim());
}

function splitValues(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseReadinessCliArgs(argv) {
  const parsed = {
    composeFiles: [],
    requiredServices: [],
    requiredUrls: [],
    timeoutMs: DEFAULT_TIMEOUT_MS,
    intervalMs: DEFAULT_INTERVAL_MS,
    prepareRunner: false,
    target: '',
    phase: '',
    composeProject: process.env.E2E_COMPOSE_PROJECT ?? '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      const next = argv[++index];
      if (!next || next.startsWith('--'))
        throw new Error(`${argument} requires a value`);
      return next;
    };
    if (argument === '--compose-file')
      parsed.composeFiles.push(...splitValues(value()));
    else if (argument === '--service')
      parsed.requiredServices.push(...splitValues(value()));
    else if (argument === '--url')
      parsed.requiredUrls.push(...splitValues(value()));
    else if (argument === '--timeout-ms') parsed.timeoutMs = Number(value());
    else if (argument === '--interval-ms') parsed.intervalMs = Number(value());
    else if (argument === '--target') parsed.target = value();
    else if (argument === '--phase') parsed.phase = value();
    else if (argument === '--compose-project') parsed.composeProject = value();
    else if (argument === '--prepare-runner') parsed.prepareRunner = true;
    else if (argument === '--help') parsed.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return parsed;
}

export function resolveReadinessOptions(input) {
  if (!input.target) {
    return {
      composeFiles: input.composeFiles ?? [],
      requiredServices: input.requiredServices ?? [],
      requiredUrls: input.requiredUrls ?? [],
      ...(input.composeProject ? { composeProject: input.composeProject } : {}),
    };
  }
  const target = resolveE2eTarget(input.target);
  if (input.phase) {
    const phases = resolveE2eLifecyclePhases(target);
    const phaseIndex = phases.findIndex((phase) => phase.name === input.phase);
    if (phaseIndex === -1) {
      throw new Error(
        `Unknown lifecycle phase ${input.phase} for ${input.target}`
      );
    }
    const completedServices = phases
      .slice(0, phaseIndex + 1)
      .filter((phase) => phase.completion === 'completed-successfully')
      .flatMap((phase) => phase.services);
    const requiredServices = phases
      .slice(0, phaseIndex + 1)
      .flatMap((phase) => phase.services);
    return {
      composeFiles: input.composeFiles?.length
        ? input.composeFiles
        : target.stack.composeFiles ?? [target.stack.composeFile],
      requiredServices,
      requiredUrls: phases[phaseIndex].readinessUrls ?? [],
      completedServices,
      ...(input.composeProject ? { composeProject: input.composeProject } : {}),
    };
  }
  return {
    composeFiles: input.composeFiles?.length
      ? input.composeFiles
      : target.stack.composeFiles ?? [target.stack.composeFile],
    requiredServices: input.requiredServices?.length
      ? input.requiredServices
      : resolveE2eServices(target),
    requiredUrls: input.requiredUrls?.length
      ? input.requiredUrls
      : target.readiness.urls ??
        (target.readiness.url ? [target.readiness.url] : []),
    completedServices: target.completedServices ?? ['db-setup'],
    ...(input.composeProject ? { composeProject: input.composeProject } : {}),
  };
}

function usage() {
  return [
    'Usage:',
    '  node scripts/wait-for-e2e-readiness.mjs --target client-interface-e2e [--phase gateway]',
    '  node scripts/wait-for-e2e-readiness.mjs --compose-file e2e/docker-compose.e2e-stack.yaml --service db-setup,gateway --url http://127.0.0.1:3000/health',
    '  node scripts/wait-for-e2e-readiness.mjs --prepare-runner',
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseReadinessCliArgs(process.argv.slice(2));
    if (args.help) process.stdout.write(`${usage()}\n`);
    else if (args.prepareRunner) await prepareRunner();
    else {
      await waitForE2eReadiness({
        ...resolveReadinessOptions(args),
        timeoutMs: args.timeoutMs,
        intervalMs: args.intervalMs,
      });
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
