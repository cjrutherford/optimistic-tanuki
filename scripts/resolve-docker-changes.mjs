import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    planFile: '',
    composeFile: 'docker-compose.yaml',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    switch (value) {
      case '--plan-file':
        args.planFile = argv[++i];
        break;
      case '--compose-file':
        args.composeFile = argv[++i];
        break;
      default:
        break;
    }
  }
  if (!args.planFile) {
    throw new Error('--plan-file is required');
  }
  return args;
}

function resolveComposeServices(composeFile) {
  const content = fs.readFileSync(composeFile, 'utf8');
  const services = [];
  const lines = content.split('\n');
  let inServices = false;
  for (const line of lines) {
    if (line.startsWith('services:')) {
      inServices = true;
      continue;
    }
    if (inServices && line.length > 0 && !line.startsWith('  ')) {
      inServices = false;
    }
    if (inServices) {
      const match = line.match(/^  ([a-z0-9][a-z0-9-]*):$/);
      if (match) services.push(match[1]);
    }
  }
  return services;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = JSON.parse(fs.readFileSync(args.planFile, 'utf8'));
  const changedApps = [...new Set(plan.buildApps || [])].sort();
  const allApps = resolveComposeServices(args.composeFile);
  const changedSet = new Set(changedApps);
  const unchangedApps = allApps.filter((app) => !changedSet.has(app));

  const matrix = JSON.stringify(changedApps);
  const hasChanges = changedApps.length > 0 ? 'true' : 'false';
  const unchangedAppSet = JSON.stringify(unchangedApps);

  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `matrix=${matrix}\n`);
    fs.appendFileSync(outputFile, `has_changes=${hasChanges}\n`);
    fs.appendFileSync(outputFile, `unchanged_apps=${unchangedAppSet}\n`);
  } else {
    process.stdout.write(
      `matrix=${matrix}\nhas_changes=${hasChanges}\nunchanged_apps=${unchangedAppSet}\n`
    );
  }
}

main();
