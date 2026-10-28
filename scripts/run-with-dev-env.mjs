#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { ensureDevDefaults } from './dev-env-defaults.mjs';

// Parse configuration as data, never shell source; exported values take precedence.
ensureDevDefaults();
const configured = parse(fs.readFileSync('.env'));
const [command, ...args] = process.argv.slice(2);
if (!command) throw Error('A development command is required');
const result = spawnSync(command, args, {
  env: { ...configured, ...process.env },
  stdio: 'inherit',
});
if (result.error)
  console.error('Unable to start the development command:', result.error.code);
process.exit(result.status ?? 1);
