import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const registryPath = path.join(
  workspaceRoot,
  'tools/public-packages/public-packages.json'
);
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const publishablePackages = registry.packages;
const allowedExternalDependenciesPath = path.join(
  workspaceRoot,
  'tools/public-packages/allowed-external-dependencies.json'
);
const allowedExternalDependencies = JSON.parse(
  fs.readFileSync(allowedExternalDependenciesPath, 'utf8')
);
const publicPackageNames = new Set(
  publishablePackages.map(
    (publishablePackage) => publishablePackage.packageName
  )
);
const publicPackageByName = new Map(
  publishablePackages.map((publishablePackage) => [
    publishablePackage.packageName,
    publishablePackage,
  ])
);

const importPattern = /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8')
  );
}

function exists(relativePath) {
  return fs.existsSync(path.join(workspaceRoot, relativePath));
}

function toWorkspacePath(filePath) {
  return path.relative(workspaceRoot, filePath);
}

function isWithinDirectory(targetPath, parentPath) {
  const relativePath = path.relative(parentPath, targetPath);

  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
}

function validateDependencySection(packageJsonPath, sectionName, packageJson) {
  const dependencies = packageJson[sectionName] ?? {};
  const allowedDependencies = new Set(
    allowedExternalDependencies[sectionName] ?? []
  );

  for (const dependencyName of Object.keys(dependencies)) {
    if (dependencyName.startsWith('@optimistic-tanuki/')) {
      const publicPackage = publicPackageByName.get(dependencyName);

      if (!publicPackage) {
        fail(
          `${packageJsonPath} ${sectionName} contains non-public workspace dependency ${dependencyName}`
        );
      }

      continue;
    }

    if (!allowedDependencies.has(dependencyName)) {
      fail(
        `${packageJsonPath} ${sectionName} contains non-allowlisted external dependency ${dependencyName}`
      );
    }
  }
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
  const readmePath = path.join(publishablePackage.root, 'README.md');

  if (!exists(packageJsonPath)) {
    fail(`${packageJsonPath} is missing`);
    continue;
  }

  if (!exists(projectJsonPath)) {
    fail(`${projectJsonPath} is missing`);
    continue;
  }

  if (!exists(readmePath)) {
    fail(`${readmePath} is missing`);
  }

  const packageJson = readJson(packageJsonPath);
  const projectJson = readJson(projectJsonPath);

  if (packageJson.name !== publishablePackage.packageName) {
    fail(`${packageJsonPath} has unexpected package name ${packageJson.name}`);
  }

  if (packageJson.private !== false) {
    fail(`${packageJsonPath} must set private=false`);
  }

  if (packageJson.publishConfig?.access !== 'public') {
    fail(`${packageJsonPath} must set publishConfig.access=public`);
  }

  if (packageJson.license !== 'MIT') {
    fail(`${packageJsonPath} must set license=MIT`);
  }

  if (!packageJson.repository?.directory) {
    fail(`${packageJsonPath} must define repository.directory`);
  }

  if (
    packageJson.repository?.directory !== publishablePackage.mirrorDirectory
  ) {
    fail(
      `${packageJsonPath} repository.directory must equal ${publishablePackage.mirrorDirectory}`
    );
  }

  if (!packageJson.repository?.url) {
    fail(`${packageJsonPath} must define repository.url`);
  }

  if (!packageJson.homepage) {
    fail(`${packageJsonPath} must define homepage`);
  }

  if (!packageJson.bugs?.url) {
    fail(`${packageJsonPath} must define bugs.url`);
  }

  if (!projectJson.tags?.includes('visibility:publishable')) {
    fail(`${projectJsonPath} must include visibility:publishable`);
  }

  if (!projectJson.targets?.build) {
    fail(`${projectJsonPath} must define a build target`);
  }

  const buildAssets = projectJson.targets.build.options?.assets ?? [];

  if (!buildAssets.includes(`${publishablePackage.root}/package.json`)) {
    fail(`${projectJsonPath} build target must copy package.json`);
  }

  if (!buildAssets.includes(`${publishablePackage.root}/README.md`)) {
    fail(`${projectJsonPath} build target must copy README.md`);
  }

  validateDependencySection(packageJsonPath, 'dependencies', packageJson);
  validateDependencySection(packageJsonPath, 'peerDependencies', packageJson);
  validateDependencySection(
    packageJsonPath,
    'optionalDependencies',
    packageJson
  );

  const srcDir = path.join(workspaceRoot, publishablePackage.root, 'src');
  const sourceFiles = walk(srcDir).filter((file) => file.endsWith('.ts'));
  const packageRoot = path.join(workspaceRoot, publishablePackage.root);

  for (const sourceFile of sourceFiles) {
    const content = fs.readFileSync(sourceFile, 'utf8');
    const relativeSourceFile = path.relative(workspaceRoot, sourceFile);
    let match;
    importPattern.lastIndex = 0;

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

      if (importPath.includes('/src/')) {
        fail(
          `${relativeSourceFile} imports a source path directly: ${importPath}`
        );
      }

      if (importPath.startsWith('.')) {
        const resolvedImportPath = path.resolve(
          path.dirname(sourceFile),
          importPath
        );

        if (!isWithinDirectory(resolvedImportPath, packageRoot)) {
          fail(
            `${relativeSourceFile} imports a relative path outside the package root: ${importPath}`
          );
        }
      }

      if (importPath.startsWith('@optimistic-tanuki/')) {
        if (!publicPackageNames.has(importPath)) {
          fail(
            `${relativeSourceFile} imports a non-public package: ${importPath}`
          );
        }
      }
    }
  }
}

if (process.exitCode) {
  process.exit();
}

console.log(
  `Publishable package boundaries are valid for ${publishablePackages.length} packages.`
);
