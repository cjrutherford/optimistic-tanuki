import fs from 'fs';
import path from 'path';

const workspaceRoot = process.cwd();
const publishablePackages = [
  {
    project: 'billing-contracts',
    packageName: '@optimistic-tanuki/billing-contracts',
    root: 'libs/billing/contracts',
  },
  {
    project: 'billing-sdk',
    packageName: '@optimistic-tanuki/billing-sdk',
    root: 'libs/billing-sdk',
  },
  {
    project: 'app-catalog-contracts',
    packageName: '@optimistic-tanuki/app-catalog-contracts',
    root: 'libs/app-catalog-contracts',
  },
];

const importPattern = /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8'),
  );
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(fullPath);
    }

    return fullPath;
  });
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

for (const publishablePackage of publishablePackages) {
  const packageJsonPath = path.join(publishablePackage.root, 'package.json');
  const projectJsonPath = path.join(publishablePackage.root, 'project.json');
  const packageJson = readJson(packageJsonPath);
  const projectJson = readJson(projectJsonPath);

  if (packageJson.name !== publishablePackage.packageName) {
    fail(`${packageJsonPath} has unexpected package name ${packageJson.name}`);
  }

  if (packageJson.private !== false) {
    fail(`${packageJsonPath} must set private=false`);
  }

  if (!projectJson.tags?.includes('visibility:publishable')) {
    fail(`${projectJsonPath} must include visibility:publishable`);
  }

  const srcDir = path.join(workspaceRoot, publishablePackage.root, 'src');
  const sourceFiles = walk(srcDir).filter((file) => file.endsWith('.ts'));

  for (const sourceFile of sourceFiles) {
    const content = fs.readFileSync(sourceFile, 'utf8');
    const relativeSourceFile = path.relative(workspaceRoot, sourceFile);
    let match;

    while ((match = importPattern.exec(content))) {
      const importPath = match[1] ?? match[2];

      if (!importPath) {
        continue;
      }

      if (importPath.startsWith('apps/') || importPath.includes('/apps/')) {
        fail(`${relativeSourceFile} imports app code: ${importPath}`);
      }

      if (importPath === '@optimistic-tanuki/models') {
        fail(`${relativeSourceFile} imports the broad models aggregator`);
      }

      if (
        importPath.startsWith('@optimistic-tanuki/') &&
        (importPath.includes('domain') || importPath.includes('data-access'))
      ) {
        fail(`${relativeSourceFile} imports an internal package: ${importPath}`);
      }
    }
  }
}

if (process.exitCode) {
  process.exit();
}

console.log('Publishable package boundaries are valid.');
