import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function enabledWorkspaceServices(workspace) {
  return (workspace.services || [])
    .filter((service) => service.enabled !== false)
    .map((service) => service.serviceID)
    .sort();
}

function targetsForWorkspace(workspace) {
  return new Set(workspace.targets || []);
}

function inventoryAppsById(inventory) {
  return new Map((inventory.apps || []).map((app) => [app.ID, app]));
}

function parseComposeServices(composeFile) {
  const composeContent = fs.readFileSync(composeFile, 'utf8').split(/\r?\n/);
  let inServices = false;
  const services = new Set();

  for (const line of composeContent) {
    if (!inServices) {
      if (/^services:\s*$/.test(line)) {
        inServices = true;
      }
      continue;
    }

    if (/^\S/.test(line) && !/^services:\s*$/.test(line)) {
      break;
    }

    const serviceMatch = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (serviceMatch) {
      services.add(serviceMatch[1]);
    }
  }

  return services;
}

function resourceNameForInventoryApp(app) {
  return path.basename(app.K8sManifestPath);
}

export function validateGeneratedWorkspace({ workspaceDir, inventory }) {
  const errors = [];
  const manifestPath = path.join(workspaceDir, 'deployment.yaml');
  if (!fs.existsSync(manifestPath)) {
    return [`Missing deployment workspace manifest: ${manifestPath}`];
  }

  const workspace = readYaml(manifestPath) || {};
  const targets = targetsForWorkspace(workspace);
  const enabledServices = enabledWorkspaceServices(workspace);
  const appsByID = inventoryAppsById(inventory);

  const composeFile = path.join(workspaceDir, 'compose', 'docker-compose.yaml');
  if (targets.has('compose')) {
    if (!fs.existsSync(composeFile)) {
      errors.push(`Missing generated compose file: ${composeFile}`);
    } else {
      const composeServices = parseComposeServices(composeFile);
      for (const serviceID of enabledServices) {
        const app = appsByID.get(serviceID);
        if (!app) {
          errors.push(
            `Enabled service ${serviceID} is not present in deployment inventory`
          );
          continue;
        }
        if (!composeServices.has(app.ComposeServiceName)) {
          errors.push(
            `Missing compose service ${app.ComposeServiceName} for enabled app ${serviceID}`
          );
        }
      }
    }
  }

  const k8sBaseDir = path.join(workspaceDir, 'k8s', 'base');
  if (targets.has('k8s')) {
    const kustomizationPath = path.join(k8sBaseDir, 'kustomization.yaml');
    if (!fs.existsSync(kustomizationPath)) {
      errors.push(`Missing generated k8s kustomization: ${kustomizationPath}`);
    } else {
      const kustomization = readYaml(kustomizationPath) || {};
      const resources = new Set(kustomization.resources || []);
      for (const serviceID of enabledServices) {
        const app = appsByID.get(serviceID);
        if (!app) {
          continue;
        }
        const resourceName = resourceNameForInventoryApp(app);
        const manifestFile = path.join(k8sBaseDir, resourceName);
        if (!resources.has(resourceName)) {
          errors.push(
            `Missing k8s resource ${resourceName} for enabled app ${serviceID}`
          );
        }
        if (!fs.existsSync(manifestFile)) {
          errors.push(`Missing generated k8s manifest: ${manifestFile}`);
        }
      }
    }
  }

  if (workspace.argocd?.applicationName) {
    const argocdPath = path.join(workspaceDir, 'argocd', 'application.yaml');
    if (!fs.existsSync(argocdPath)) {
      errors.push(`Missing generated ArgoCD application: ${argocdPath}`);
    } else {
      const argocd = fs.readFileSync(argocdPath, 'utf8');
      const expectedPath = `dist/admin-env/${workspace.deploymentName}/k8s`;
      if (!argocd.includes(`path: ${expectedPath}`)) {
        errors.push(
          `ArgoCD application must target generated workspace path ${expectedPath}`
        );
      }
    }
  }

  return errors;
}
