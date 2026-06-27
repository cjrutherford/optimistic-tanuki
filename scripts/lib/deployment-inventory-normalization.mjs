function aliasValue(primary, fallback) {
  return primary ?? fallback ?? '';
}

function normalizeApp(app) {
  const id = aliasValue(app.id, app.ID);
  const buildAppId = aliasValue(app.buildAppId, app.BuildAppID);
  const composeServiceName = aliasValue(
    app.composeServiceName,
    app.ComposeServiceName
  );
  const imageName = aliasValue(app.imageName, app.ImageName);
  const k8sManifestPath = aliasValue(app.k8sManifestPath, app.K8sManifestPath);

  return {
    ...app,
    id,
    ID: id,
    buildAppId,
    BuildAppID: buildAppId,
    composeServiceName,
    ComposeServiceName: composeServiceName,
    imageName,
    ImageName: imageName,
    k8sManifestPath,
    K8sManifestPath: k8sManifestPath,
  };
}

export function normalizeDeploymentInventory(inventory) {
  return {
    ...inventory,
    apps: (inventory?.apps || []).map(normalizeApp),
  };
}
