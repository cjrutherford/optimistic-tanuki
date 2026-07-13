import {
  AngularNodeAppEngine,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SetupService } from './server/setup.service';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();
const setup = new SetupService();

app.use(express.json());

// --- Setup API ---

app.get('/api/setup/status', async (_req, res) => {
  res.json(await setup.getStatus());
});

app.get('/api/setup/state', async (_req, res) => {
  try {
    const environment =
      typeof _req.query['env'] === 'string' ? _req.query['env'] : undefined;
    const data = await setup.loadConfig(environment);
    res.json({ success: true, data });
  } catch (e) {
    res.json({ success: false, data: null });
  }
});

app.put('/api/setup/state', async (req, res) => {
  try {
    const environment =
      typeof req.query['env'] === 'string' ? req.query['env'] : undefined;
    await setup.saveConfig(req.body, environment);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: e instanceof Error ? e.message : 'Save failed',
    });
  }
});

app.get('/api/setup/settings/catalog', async (_req, res) => {
  try {
    const environment =
      typeof _req.query['env'] === 'string' ? _req.query['env'] : undefined;
    res.json(await setup.getSettingsCatalog(environment));
  } catch (e) {
    res.status(500).json({ groups: [], targets: [] });
  }
});

app.get('/api/setup/host-paths', async (req, res) => {
  try {
    const requestedPath =
      typeof req.query['path'] === 'string' ? req.query['path'] : undefined;
    res.json(await setup.browseHostPath(requestedPath));
  } catch (e) {
    res.status(500).json({
      currentPath: '',
      parentPath: undefined,
      entries: [],
      message: e instanceof Error ? e.message : 'Browse failed',
    });
  }
});

app.post('/api/setup/managed-files', async (req, res) => {
  try {
    const result = await setup.storeManagedFile({
      environmentName:
        typeof req.body.environment === 'string'
          ? req.body.environment
          : undefined,
      filename: req.body.filename,
      contentBase64: req.body.contentBase64,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: e instanceof Error ? e.message : 'Upload failed',
    });
  }
});

app.get('/api/setup/environments', async (_req, res) => {
  try {
    res.json(await setup.listEnvironments());
  } catch (e) {
    res.status(500).json({ activeEnvironment: 'production', environments: [] });
  }
});

app.post('/api/setup/environments', async (req, res) => {
  try {
    const data = await setup.createEnvironment(req.body.name);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: e instanceof Error ? e.message : 'Create failed',
    });
  }
});

app.post('/api/setup/takeover', async (req, res) => {
  try {
    const result = await setup.takeOverDeployment({
      deploymentPath: req.body.deploymentPath,
      secretsPath: req.body.secretsPath,
      environmentName: req.body.environmentName,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: e instanceof Error ? e.message : 'Takeover failed',
    });
  }
});

app.get('/api/setup/secrets', async (_req, res) => {
  try {
    const environment =
      typeof _req.query['env'] === 'string' ? _req.query['env'] : undefined;
    const secrets = await setup.loadSecrets(environment);
    res.json({ success: true, data: secrets });
  } catch (e) {
    res.json({ success: true, data: {} });
  }
});

app.put('/api/setup/secrets', async (req, res) => {
  try {
    const environment =
      typeof req.query['env'] === 'string' ? req.query['env'] : undefined;
    await setup.saveSecrets(req.body, environment);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: e instanceof Error ? e.message : 'Save failed',
    });
  }
});

app.get('/api/setup/email/status', async (req, res) => {
  try {
    const environment =
      typeof req.query['env'] === 'string' ? req.query['env'] : undefined;
    res.json(await setup.getEmailStatus(environment));
  } catch (e) {
    res.status(500).json({
      message: e instanceof Error ? e.message : 'Email status failed',
    });
  }
});

app.put('/api/setup/email/configure', async (req, res) => {
  try {
    const environment =
      typeof req.query['env'] === 'string' ? req.query['env'] : undefined;
    await setup.configureEmail(req.body, environment);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: e instanceof Error ? e.message : 'Email config failed',
    });
  }
});

app.post('/api/setup/email/test', async (req, res) => {
  try {
    const environment =
      typeof req.query['env'] === 'string' ? req.query['env'] : undefined;
    res.json(
      await setup.testEmail(req.body.recipient, req.body.from, environment)
    );
  } catch (e) {
    res.status(502).json({
      success: false,
      message: e instanceof Error ? e.message : 'Email test failed',
    });
  }
});

app.post('/api/setup/validate', async (_req, res) => {
  res.json(await setup.validate());
});

app.post('/api/setup/build', async (_req, res) => {
  res.json(await setup.buildImages());
});

app.post('/api/setup/infra', async (_req, res) => {
  res.json(await setup.provisionInfra());
});

app.post('/api/setup/db', async (_req, res) => {
  res.json(await setup.initDatabases());
});

app.post('/api/setup/deploy', async (_req, res) => {
  res.json(await setup.deployServices());
});

app.post('/api/setup/deploy-all', async (_req, res) => {
  res.json(await setup.deployAll());
});

app.get('/api/setup/deploy-progress', async (_req, res) => {
  res.json(setup.getDeployProgress());
});

app.post('/api/setup/owner', async (req, res) => {
  try {
    const result = await setup.createOwner(
      req.body.name,
      req.body.email,
      req.body.password
    );
    res.json(result);
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : 'Owner creation failed',
    });
  }
});

app.post('/api/setup/save-operator', async (req, res) => {
  try {
    await setup.saveOperator(req.body.name, req.body.email, req.body.password);
    res.json({ saved: true });
  } catch (e) {
    res.status(500).json({
      saved: false,
      error: e instanceof Error ? e.message : 'Save failed',
    });
  }
});

app.get('/api/setup/operator', async (_req, res) => {
  try {
    const operator = await setup.getSavedOperatorSummary();
    res.json({ saved: !!operator, operator });
  } catch (e) {
    res.status(500).json({ saved: false, operator: null });
  }
});

app.post('/api/setup/activate', async (_req, res) => {
  try {
    await setup.completeSetup();
    res.json({ activated: true });
  } catch (e) {
    res.status(500).json({
      activated: false,
      error: e instanceof Error ? e.message : 'Activation failed',
    });
  }
});

app.put('/api/setup/oauth/configure', async (req, res) => {
  try {
    const environment =
      typeof req.query['env'] === 'string' ? req.query['env'] : undefined;
    await setup.configureOAuthProvider(
      req.body.provider,
      {
        enabled: req.body.enabled,
        clientId: req.body.clientId,
        clientSecret: req.body.clientSecret,
        redirectUri: req.body.redirectUri,
      },
      environment
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: e instanceof Error ? e.message : 'OAuth config failed',
    });
  }
});

app.get('/api/setup/oauth/providers', async (_req, res) => {
  try {
    const environment =
      typeof _req.query['env'] === 'string' ? _req.query['env'] : undefined;
    res.json(await setup.getOAuthProviders(environment));
  } catch (e) {
    res.status(500).json({
      enabled: false,
      bridgeAppId: 'client-interface',
      bridgeAppDomain: '',
      bridgeAppBaseUrl: '',
      providers: [],
    });
  }
});

app.get('/api/setup/oauth/apps', async (_req, res) => {
  try {
    const environment =
      typeof _req.query['env'] === 'string' ? _req.query['env'] : undefined;
    res.json(await setup.getOAuthApps(environment));
  } catch (e) {
    res.status(500).json({
      bridgeAppId: 'client-interface',
      bridgeAppDomain: '',
      bridgeAppBaseUrl: '',
      apps: [],
    });
  }
});

app.post('/api/setup/oauth/test', async (req, res) => {
  try {
    const environment =
      typeof req.query['env'] === 'string' ? req.query['env'] : undefined;
    res.json(await setup.testOAuthProvider(req.body.provider, environment));
  } catch (e) {
    res.status(500).json({
      provider: String(req.body.provider || ''),
      reachable: false,
      credentialValid: false,
      authorizationEndpointOk: false,
      tokenEndpointOk: false,
      userInfoEndpointOk: false,
      responseTimeMs: 0,
      testedAt: new Date().toISOString(),
      errors: [e instanceof Error ? e.message : 'OAuth test failed'],
    });
  }
});

// --- Static files ---
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

// --- Angular SSR ---
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

// --- Start ---
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 8099;
  app.listen(port, () => {
    console.log(`[setup-console] Server running on http://localhost:${port}`);
  });
}

export const reqHandler = app;
