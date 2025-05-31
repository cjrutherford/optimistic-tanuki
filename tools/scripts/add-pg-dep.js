// filepath: /home/cjrutherford/workspace/optimistic-tanuki/tools/scripts/add-pg-dep.js
const fs = require('fs');
const path = require('path');
const workspaceRoot = process.cwd(); // Assuming script is run from workspace root

const projectDistPath = process.argv[2]; // e.g., "dist/apps/authentication"
if (!projectDistPath) {
  console.error('Usage: node tools/scripts/add-pg-dep.js <project-dist-path-from-root>');
  process.exit(1);
}

const packageJsonPath = path.join(workspaceRoot, projectDistPath, 'package.json');

// Get pg version from root package.json
let pgVersion = '^8.16.0'; // Default fallback
try {
  const rootPackageJsonPath = path.join(workspaceRoot, 'package.json');
  if (fs.existsSync(rootPackageJsonPath)) {
    const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'));
    if (rootPackageJson.dependencies && rootPackageJson.dependencies.pg) {
      pgVersion = rootPackageJson.dependencies.pg;
    } else if (rootPackageJson.devDependencies && rootPackageJson.devDependencies.pg) {
      // Also check devDependencies, though less common for runtime deps
      pgVersion = rootPackageJson.devDependencies.pg;
    }
  } else {
    console.warn('Root package.json not found, using default pg version.');
  }
} catch (e) {
  console.warn(`Could not read pg version from root package.json, using default. Error: ${e.message}`);
}

if (fs.existsSync(packageJsonPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    pkg.dependencies = pkg.dependencies || {};
    pkg.dependencies.pg = pgVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
    console.log(`Successfully injected pg@${pgVersion} dependency into ${packageJsonPath}`);
  } catch (e) {
    console.error(`Error processing ${packageJsonPath}: ${e.message}`);
    process.exit(1);
  }
} else {
  console.warn(`Warning: ${packageJsonPath} not found. Skipping pg dependency injection.`);
  // Depending on requirements, this could be an error: process.exit(1);
}
