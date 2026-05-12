import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const registryPath = path.join(
  workspaceRoot,
  'tools/public-packages/public-packages.json'
);
const mirrorTemplateRoot = path.join(
  workspaceRoot,
  'tools/public-packages/mirror-root'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();

  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith('--')) {
      continue;
    }

    if (argument.includes('=')) {
      const [key, ...rest] = argument.split('=');
      values.set(key, rest.join('='));
      continue;
    }

    const nextArgument = argv[index + 1];

    if (!nextArgument || nextArgument.startsWith('--')) {
      flags.add(argument);
      continue;
    }

    values.set(argument, nextArgument);
    index += 1;
  }

  return { flags, values };
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function removeIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function copyIfExists(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  ensureDirectory(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function rewritePackageManifest(packageManifest, packageEntry, mirrorRepoSlug) {
  const baseUrl = `https://github.com/${mirrorRepoSlug}`;

  return {
    ...packageManifest,
    repository: {
      type: 'git',
      url: `git+${baseUrl}.git`,
      directory: packageEntry.mirrorDirectory,
    },
    homepage: `${baseUrl}/tree/main/${packageEntry.mirrorDirectory}`,
    bugs: {
      url: `${baseUrl}/issues`,
    },
  };
}

function rewriteProjectConfig(projectConfig, packageEntry) {
  const mirrorDirectory = packageEntry.mirrorDirectory;

  return {
    ...projectConfig,
    root: mirrorDirectory,
    sourceRoot: `${mirrorDirectory}/src`,
    targets: {
      ...projectConfig.targets,
      build: {
        ...projectConfig.targets.build,
        options: {
          ...projectConfig.targets.build.options,
          outputPath: `dist/${mirrorDirectory}`,
          main: `${mirrorDirectory}/src/index.ts`,
          tsConfig: `${mirrorDirectory}/tsconfig.lib.json`,
          assets: [
            `${mirrorDirectory}/package.json`,
            `${mirrorDirectory}/README.md`,
          ],
        },
      },
      test: projectConfig.targets.test
        ? {
            ...projectConfig.targets.test,
            options: {
              ...projectConfig.targets.test.options,
              jestConfig: `${mirrorDirectory}/jest.config.ts`,
            },
          }
        : undefined,
    },
  };
}

function rewriteJestConfig(jestConfigContent, packageEntry) {
  return jestConfigContent
    .replace(
      /preset:\s*['"][^'"]+jest\.preset\.js['"]/,
      "preset: '../../jest.preset.js'"
    )
    .replace(
      /coverageDirectory:\s*['"][^'"]+['"]/,
      `coverageDirectory: '../../coverage/${packageEntry.mirrorDirectory}'`
    );
}

function rewriteRootTsconfig(tsconfigContent) {
  return {
    ...tsconfigContent,
    extends: '../../tsconfig.base.json',
  };
}

function rewriteLibTsconfig(tsconfigContent) {
  return {
    ...tsconfigContent,
    compilerOptions: {
      ...tsconfigContent.compilerOptions,
      outDir: '../../dist/out-tsc',
    },
  };
}

function rewriteSpecTsconfig(tsconfigContent) {
  return {
    ...tsconfigContent,
    compilerOptions: {
      ...tsconfigContent.compilerOptions,
      outDir: '../../dist/out-tsc',
    },
  };
}

function buildMirrorTsconfigBase(sourceTsconfigBase, packageEntries) {
  const publicPaths = {};

  for (const packageEntry of packageEntries) {
    publicPaths[packageEntry.packageName] = [
      `${packageEntry.mirrorDirectory}/src/index.ts`,
    ];
  }

  return {
    ...sourceTsconfigBase,
    compilerOptions: {
      ...sourceTsconfigBase.compilerOptions,
      paths: publicPaths,
    },
  };
}

function buildMirrorNxJson(sourceNxJson) {
  return {
    $schema: './node_modules/nx/schemas/nx-schema.json',
    useDaemonProcess: false,
    namedInputs: {
      default: ['{projectRoot}/**/*', 'sharedGlobals'],
      production: sourceNxJson.namedInputs.production,
      sharedGlobals: ['{workspaceRoot}/.github/workflows/release-packages.yml'],
    },
    targetDefaults: {
      build: sourceNxJson.targetDefaults.build,
      '@nx/js:tsc': sourceNxJson.targetDefaults['@nx/js:tsc'],
      '@nx/jest:jest': sourceNxJson.targetDefaults['@nx/jest:jest'],
    },
  };
}

function collectPackageFiles(packageEntry) {
  const packageRoot = path.join(workspaceRoot, packageEntry.root);

  return [
    ['src', 'src'],
    ['package.json', 'package.json'],
    ['README.md', 'README.md'],
    ['project.json', 'project.json'],
    ['jest.config.ts', 'jest.config.ts'],
    ['tsconfig.json', 'tsconfig.json'],
    ['tsconfig.lib.json', 'tsconfig.lib.json'],
    ['tsconfig.spec.json', 'tsconfig.spec.json'],
  ]
    .map(([relativeSource, relativeTarget]) => ({
      source: path.join(packageRoot, relativeSource),
      target: relativeTarget,
    }))
    .filter((entry) => fs.existsSync(entry.source));
}

function resolveMirrorRepoSlug(registry, args) {
  const configuredValue =
    args.values.get('--mirror-repo-slug') ??
    process.env[registry.mirrorRepo.slugEnvVar] ??
    registry.mirrorRepo.slug;

  return {
    slug: configuredValue ?? registry.mirrorRepo.placeholderSlug,
    mode: configuredValue ? 'configured' : 'placeholder',
  };
}

function resolveOutputRoot(registry, args) {
  const configuredValue =
    args.values.get('--output') ??
    process.env[registry.mirrorRepo.outputPathEnvVar] ??
    registry.mirrorRepo.defaultOutput;

  return path.resolve(workspaceRoot, configuredValue);
}

function preflight(packageEntries) {
  for (const packageEntry of packageEntries) {
    const packageRoot = path.join(workspaceRoot, packageEntry.root);

    if (!fs.existsSync(packageRoot)) {
      throw new Error(`Package root does not exist: ${packageEntry.root}`);
    }

    for (const requiredPath of [
      'src',
      'package.json',
      'README.md',
      'project.json',
    ]) {
      const absolutePath = path.join(packageRoot, requiredPath);

      if (!fs.existsSync(absolutePath)) {
        throw new Error(
          `Missing required package file: ${path.relative(
            workspaceRoot,
            absolutePath
          )}`
        );
      }
    }
  }

  if (!fs.existsSync(mirrorTemplateRoot)) {
    throw new Error('Mirror root template directory is missing.');
  }
}

const args = parseArgs(process.argv);
const registry = readJson(registryPath);
const dryRun = args.flags.has('--dry-run');
const outputRoot = resolveOutputRoot(registry, args);
const mirrorRepo = resolveMirrorRepoSlug(registry, args);
const packageEntries = registry.packages;
const sourceTsconfigBase = readJson(
  path.join(workspaceRoot, 'tsconfig.base.json')
);
const sourceNxJson = readJson(path.join(workspaceRoot, 'nx.json'));

preflight(packageEntries);

const generatedManifest = {
  generatedBy: 'scripts/sync-public-packages.mjs',
  mirrorRepoSlug: mirrorRepo.slug,
  mirrorRepoMode: mirrorRepo.mode,
  packages: packageEntries.map((packageEntry) => ({
    project: packageEntry.project,
    packageName: packageEntry.packageName,
    sourceRoot: packageEntry.root,
    mirrorDirectory: packageEntry.mirrorDirectory,
  })),
};

if (dryRun) {
  console.log(`Mirror output root: ${outputRoot}`);
  console.log(`Mirror repo slug mode: ${mirrorRepo.mode}`);
  console.log(`Mirror repo slug: ${mirrorRepo.slug}`);
  console.log('Packages to export:');

  for (const packageEntry of packageEntries) {
    console.log(
      `- ${packageEntry.project}: ${packageEntry.root} -> ${packageEntry.mirrorDirectory}`
    );
  }

  process.exit(0);
}

ensureDirectory(outputRoot);

for (const generatedPath of [
  'packages',
  '.changeset',
  '.github',
  'package.json',
  'pnpm-workspace.yaml',
  'README.md',
  '.npmrc.example',
  '.gitignore',
  'nx.json',
  'tsconfig.base.json',
  'jest.preset.js',
  'public-packages-manifest.json',
]) {
  removeIfExists(path.join(outputRoot, generatedPath));
}

fs.cpSync(mirrorTemplateRoot, outputRoot, { recursive: true });

const sourceChangesetRoot = path.join(workspaceRoot, '.changeset');
copyIfExists(sourceChangesetRoot, path.join(outputRoot, '.changeset'));

writeJson(path.join(outputRoot, 'nx.json'), buildMirrorNxJson(sourceNxJson));
writeJson(
  path.join(outputRoot, 'tsconfig.base.json'),
  buildMirrorTsconfigBase(sourceTsconfigBase, packageEntries)
);
fs.writeFileSync(
  path.join(outputRoot, 'jest.preset.js'),
  "const nxPreset = require('@nx/jest/preset').default;\n\nmodule.exports = { ...nxPreset };\n"
);

for (const packageEntry of packageEntries) {
  const packageOutputRoot = path.join(outputRoot, packageEntry.mirrorDirectory);
  ensureDirectory(packageOutputRoot);

  for (const fileEntry of collectPackageFiles(packageEntry)) {
    copyIfExists(
      fileEntry.source,
      path.join(packageOutputRoot, fileEntry.target)
    );
  }

  const packageJsonPath = path.join(packageOutputRoot, 'package.json');
  const projectJsonPath = path.join(packageOutputRoot, 'project.json');
  const jestConfigPath = path.join(packageOutputRoot, 'jest.config.ts');
  const tsconfigPath = path.join(packageOutputRoot, 'tsconfig.json');
  const tsconfigLibPath = path.join(packageOutputRoot, 'tsconfig.lib.json');
  const tsconfigSpecPath = path.join(packageOutputRoot, 'tsconfig.spec.json');

  writeJson(
    packageJsonPath,
    rewritePackageManifest(
      readJson(packageJsonPath),
      packageEntry,
      mirrorRepo.slug
    )
  );
  writeJson(
    projectJsonPath,
    rewriteProjectConfig(readJson(projectJsonPath), packageEntry)
  );

  if (fs.existsSync(jestConfigPath)) {
    fs.writeFileSync(
      jestConfigPath,
      `${rewriteJestConfig(
        fs.readFileSync(jestConfigPath, 'utf8'),
        packageEntry
      ).trimEnd()}\n`
    );
  }

  if (fs.existsSync(tsconfigPath)) {
    writeJson(tsconfigPath, rewriteRootTsconfig(readJson(tsconfigPath)));
  }

  if (fs.existsSync(tsconfigLibPath)) {
    writeJson(tsconfigLibPath, rewriteLibTsconfig(readJson(tsconfigLibPath)));
  }

  if (fs.existsSync(tsconfigSpecPath)) {
    writeJson(
      tsconfigSpecPath,
      rewriteSpecTsconfig(readJson(tsconfigSpecPath))
    );
  }
}

writeJson(
  path.join(outputRoot, 'public-packages-manifest.json'),
  generatedManifest
);

console.log(
  `Synced ${packageEntries.length} public packages to ${toPosixPath(
    outputRoot
  )} using ${mirrorRepo.mode} mirror metadata.`
);
