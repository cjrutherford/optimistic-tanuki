#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

import {
  E2E_ENVIRONMENT_MANIFEST,
  resolveE2eServices,
} from './e2e-environment-manifest.mjs';

function hostPort(url) {
  return Number(new URL(url).port || (url.startsWith('https:') ? 443 : 80));
}

function composePorts(service) {
  return (service?.ports ?? []).map((port) => Number(port.published));
}

export function validateE2eEnvironment({
  manifest = E2E_ENVIRONMENT_MANIFEST,
  nxGraph,
  composeConfig,
}) {
  const errors = [];
  const nodes = nxGraph?.graph?.nodes ?? {};
  const dependencies = nxGraph?.graph?.dependencies ?? {};
  const services = composeConfig?.services ?? {};
  const seenProjects = new Set();
  const groupPorts = new Map();

  for (const entry of manifest) {
    const project = entry.nx?.project;
    if (!project || seenProjects.has(project)) {
      errors.push(
        `E2E target ${project || '<missing>'} is duplicated or missing`
      );
      continue;
    }
    seenProjects.add(project);

    const projectData = nodes[project]?.data;
    if (!projectData)
      errors.push(`${project} is not present in the Nx project graph`);
    else if (!projectData.targets?.[entry.nx.target]) {
      errors.push(`${project} does not expose Nx target ${entry.nx.target}`);
    }

    if (!nodes[entry.app])
      errors.push(
        `${project} app ${entry.app} is not present in the Nx project graph`
      );
    const hasAppDependency = (dependencies[project] ?? []).some(
      (dependency) => dependency.target === entry.app
    );
    if (!hasAppDependency)
      errors.push(`${project} must depend on app ${entry.app}`);

    if (hostPort(entry.baseUrl) !== entry.readiness.port) {
      errors.push(`${project} base URL port must match readiness port`);
    }
    if (entry.imageBudget?.maxPullServices < resolveE2eServices(entry).length) {
      errors.push(
        `${project} image budget is below its resolved service count`
      );
    }
    const lifecycleServices =
      entry.lifecycle?.phases?.flatMap((phase) => phase.services) ?? [];
    if (
      !Array.isArray(entry.lifecycle?.phases) ||
      lifecycleServices.length === 0
    ) {
      errors.push(`${project} must declare ordered lifecycle phases`);
    } else if (
      lifecycleServices.length !== resolveE2eServices(entry).length ||
      new Set(lifecycleServices).size !== lifecycleServices.length ||
      lifecycleServices.some(
        (service) => !resolveE2eServices(entry).includes(service)
      )
    ) {
      errors.push(
        `${project} lifecycle phases must cover each resolved service exactly once`
      );
    }
    const seedIndex =
      entry.lifecycle?.phases?.findIndex(
        (phase) => phase.name === 'app-configurator-seed'
      ) ?? -1;
    const configuratorIndex =
      entry.lifecycle?.phases?.findIndex(
        (phase) => phase.name === 'app-configurator'
      ) ?? -1;
    if (
      seedIndex >= 0 &&
      (configuratorIndex < 0 || configuratorIndex > seedIndex)
    ) {
      errors.push(
        `${project} must run app-configurator before app-configurator-seed`
      );
    }
    for (const service of entry.completedServices ?? []) {
      if (!resolveE2eServices(entry).includes(service)) {
        errors.push(
          `${project} completed service ${service} is not in its resolved service set`
        );
      }
    }

    if (entry.stack.mode !== 'shared') continue;
    const stackService = services[entry.stack.service];
    if (!stackService)
      errors.push(
        `${project} stack service ${entry.stack.service} is not a Compose service`
      );
    else if (!composePorts(stackService).includes(entry.readiness.port)) {
      errors.push(
        `${project} readiness port ${entry.readiness.port} is not published by ${entry.stack.service}`
      );
    }
    if (
      entry.stack.profile &&
      !stackService?.profiles?.includes(entry.stack.profile)
    ) {
      errors.push(
        `${project} profile ${entry.stack.profile} is not declared by ${entry.stack.service}`
      );
    }
    for (const dependency of entry.backendDependencies) {
      if (!services[dependency])
        errors.push(
          `${project} backend dependency ${dependency} is not a Compose service`
        );
    }
    const groupKey = `${entry.concurrencyGroup}:${entry.readiness.port}`;
    if (groupPorts.has(groupKey)) {
      errors.push(
        `${entry.concurrencyGroup} reuses host port ${
          entry.readiness.port
        } for ${groupPorts.get(groupKey)} and ${project}`
      );
    } else groupPorts.set(groupKey, project);
  }
  if (
    manifest.some(
      (entry) =>
        entry.suiteKind === 'ui' &&
        entry.backendDependencies.includes('gateway')
    ) &&
    services.gateway?.environment?.NODE_ENV !== 'test'
  ) {
    errors.push(
      'E2E gateway NODE_ENV must be test for localhost authentication callbacks'
    );
  }
  if (
    services.authentication?.environment?.AUTH_AUTO_VERIFY_EMAILS !== 'true'
  ) {
    errors.push('E2E authentication must auto-verify test emails');
  }
  return errors;
}

function readNxGraph() {
  return JSON.parse(
    execFileSync('pnpm', ['exec', 'nx', 'graph', '--print'], {
      encoding: 'utf8',
      env: { ...process.env, NX_DAEMON: 'false', NX_ISOLATE_PLUGINS: 'false' },
    })
  );
}

function readComposeConfig() {
  const profiles = E2E_ENVIRONMENT_MANIFEST.filter(
    (entry) => entry.stack.mode === 'shared' && entry.stack.profile
  )
    .map((entry) => entry.stack.profile)
    .join(',');
  return JSON.parse(
    execFileSync(
      'docker',
      [
        'compose',
        '-f',
        'e2e/docker-compose.e2e-stack.yaml',
        'config',
        '--format',
        'json',
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, COMPOSE_PROFILES: profiles },
      }
    )
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = validateE2eEnvironment({
    nxGraph: readNxGraph(),
    composeConfig: readComposeConfig(),
  });
  if (errors.length) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('E2E environment manifest is valid.\n');
  }
}
