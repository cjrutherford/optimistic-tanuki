#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  createComposeBuildPlan,
  loadPlannerState,
  savePlannerState,
} from './lib/docker-service-planner.mjs';

function parseArgs(argv) {
  const args = {
    composeFile: 'docker-compose.yaml',
    workspaceRoot: process.cwd(),
    stateFile: '',
    planFile: '',
    changedFilesFile: '',
    baseRef: '',
    headRef: '',
    saveState: false,
    forceAll: false,
    selectedServices: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case '--compose-file':
        args.composeFile = argv[++index];
        break;
      case '--workspace-root':
        args.workspaceRoot = argv[++index];
        break;
      case '--state-file':
        args.stateFile = argv[++index];
        break;
      case '--write-plan':
        args.planFile = argv[++index];
        break;
      case '--changed-files-file':
        args.changedFilesFile = argv[++index];
        break;
      case '--base-ref':
        args.baseRef = argv[++index];
        break;
      case '--head-ref':
        args.headRef = argv[++index];
        break;
      case '--save-state':
        args.saveState = true;
        break;
      case '--force-all':
        args.forceAll = true;
        break;
      case '--services':
        args.selectedServices.push(
          ...argv[++index]
            .split(',')
            .map((service) => service.trim())
            .filter(Boolean)
        );
        break;
      case '--service':
        args.selectedServices.push(argv[++index]);
        break;
      default:
        throw new Error(`Unknown argument: ${value}`);
    }
  }

  return args;
}

function readChangedFiles({
  changedFilesFile,
  baseRef,
  headRef,
  workspaceRoot,
}) {
  if (changedFilesFile) {
    if (!fs.existsSync(changedFilesFile)) {
      return [];
    }

    return fs
      .readFileSync(changedFilesFile, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  if (baseRef && headRef) {
    const output = execFileSync(
      'git',
      ['diff', '--name-only', baseRef, headRef],
      {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }
    );

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return null;
}

const args = parseArgs(process.argv.slice(2));
const workspaceRoot = path.resolve(args.workspaceRoot);
const previousState = args.stateFile ? loadPlannerState(args.stateFile) : null;
const changedFiles = readChangedFiles({
  changedFilesFile: args.changedFilesFile,
  baseRef: args.baseRef,
  headRef: args.headRef,
  workspaceRoot,
});

const plan = await createComposeBuildPlan({
  workspaceRoot,
  composeFile: args.composeFile,
  previousState,
  changedFiles,
  forceAll: args.forceAll,
  selectedServices: args.selectedServices,
});

if (args.planFile) {
  fs.mkdirSync(path.dirname(args.planFile), { recursive: true });
  fs.writeFileSync(args.planFile, JSON.stringify(plan, null, 2));
}

if (args.saveState) {
  if (!args.stateFile) {
    throw new Error('--save-state requires --state-file');
  }
  savePlannerState(args.stateFile, plan.state);
}

process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
