import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Observable } from 'rxjs';
import { SetupClientService } from './setup-client.service';

/**
 * Every method here is a thin delegation to one HTTP endpoint, so the things
 * worth pinning are the verb, the URL, and the body -- a wrong pattern would
 * silently hit the wrong setup endpoint.
 *
 * Most reads take an optional environment that becomes a `?env=` query. That
 * branch is exercised separately below, including the encoding, because an
 * unencoded environment name would land on the wrong environment rather than
 * failing loudly.
 */
describe('SetupClientService', () => {
  let service: SetupClientService;
  let http: HttpTestingController;

  const BASE = '/api/setup';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SetupClientService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(SetupClientService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  interface Case {
    desc: string;
    call: (s: SetupClientService) => Observable<unknown>;
    method: 'GET' | 'POST' | 'PUT';
    url: string;
    body?: unknown;
  }

  const cases: Case[] = [
    // --- status, environments, takeover ---
    {
      desc: 'getStatus',
      call: (s) => s.getStatus(),
      method: 'GET',
      url: `${BASE}/status`,
    },
    {
      desc: 'getEnvironments',
      call: (s) => s.getEnvironments(),
      method: 'GET',
      url: `${BASE}/environments`,
    },
    {
      desc: 'createEnvironment',
      call: (s) => s.createEnvironment('staging'),
      method: 'POST',
      url: `${BASE}/environments`,
      body: { name: 'staging' },
    },
    {
      desc: 'takeOverDeployment',
      call: (s) =>
        s.takeOverDeployment({
          deploymentPath: '/srv/app',
          secretsPath: '/srv/secrets',
          environmentName: 'prod',
        }),
      method: 'POST',
      url: `${BASE}/takeover`,
      body: {
        deploymentPath: '/srv/app',
        secretsPath: '/srv/secrets',
        environmentName: 'prod',
      },
    },

    // --- config / secrets / catalog ---
    {
      desc: 'getConfig without an environment',
      call: (s) => s.getConfig(),
      method: 'GET',
      url: `${BASE}/state`,
    },
    {
      desc: 'saveConfig',
      call: (s) => s.saveConfig({ version: 1 } as never),
      method: 'PUT',
      url: `${BASE}/state`,
      body: { version: 1 },
    },
    {
      desc: 'getSettingsCatalog',
      call: (s) => s.getSettingsCatalog(),
      method: 'GET',
      url: `${BASE}/settings/catalog`,
    },
    {
      desc: 'getSecrets',
      call: (s) => s.getSecrets(),
      method: 'GET',
      url: `${BASE}/secrets`,
    },
    {
      desc: 'saveSecrets',
      call: (s) => s.saveSecrets({ DB_PASSWORD: 'hunter2' }),
      method: 'PUT',
      url: `${BASE}/secrets`,
      body: { DB_PASSWORD: 'hunter2' },
    },

    // --- host paths and managed files ---
    {
      desc: 'browseHostPath without a path',
      call: (s) => s.browseHostPath(),
      method: 'GET',
      url: `${BASE}/host-paths`,
    },
    {
      desc: 'uploadManagedFile',
      call: (s) =>
        s.uploadManagedFile({ filename: 'ca.pem', contentBase64: 'YWJj' }),
      method: 'POST',
      url: `${BASE}/managed-files`,
      body: { filename: 'ca.pem', contentBase64: 'YWJj' },
    },

    // --- the deploy pipeline: each stage is its own endpoint ---
    {
      desc: 'validate',
      call: (s) => s.validate(),
      method: 'POST',
      url: `${BASE}/validate`,
      body: {},
    },
    {
      desc: 'buildImages',
      call: (s) => s.buildImages(),
      method: 'POST',
      url: `${BASE}/build`,
      body: {},
    },
    {
      desc: 'provisionInfraCompose',
      call: (s) => s.provisionInfraCompose(),
      method: 'POST',
      url: `${BASE}/infra`,
      body: {},
    },
    {
      desc: 'initDatabases',
      call: (s) => s.initDatabases(),
      method: 'POST',
      url: `${BASE}/db`,
      body: {},
    },
    {
      desc: 'deployServices',
      call: (s) => s.deployServices(),
      method: 'POST',
      url: `${BASE}/deploy`,
      body: {},
    },
    {
      desc: 'deployAll',
      call: (s) => s.deployAll(),
      method: 'POST',
      url: `${BASE}/deploy-all`,
      body: {},
    },
    {
      desc: 'getDeployProgress',
      call: (s) => s.getDeployProgress(),
      method: 'GET',
      url: `${BASE}/deploy-progress`,
    },

    // --- oauth ---
    {
      desc: 'getOAuthProviders',
      call: (s) => s.getOAuthProviders(),
      method: 'GET',
      url: `${BASE}/oauth/providers`,
    },
    {
      desc: 'getOAuthApps',
      call: (s) => s.getOAuthApps(),
      method: 'GET',
      url: `${BASE}/oauth/apps`,
    },
    {
      desc: 'testOAuthProvider',
      call: (s) => s.testOAuthProvider('github'),
      method: 'POST',
      url: `${BASE}/oauth/test`,
      body: { provider: 'github' },
    },
    {
      desc: 'configureOAuthProvider flattens the config alongside the provider',
      call: (s) =>
        s.configureOAuthProvider('github', {
          enabled: true,
          clientId: 'cid',
          clientSecret: 'secret',
          redirectUri: 'https://example.test/cb',
        }),
      method: 'PUT',
      url: `${BASE}/oauth/configure`,
      body: {
        provider: 'github',
        enabled: true,
        clientId: 'cid',
        clientSecret: 'secret',
        redirectUri: 'https://example.test/cb',
      },
    },

    // --- email ---
    {
      desc: 'getEmailStatus',
      call: (s) => s.getEmailStatus(),
      method: 'GET',
      url: `${BASE}/email/status`,
    },
    {
      desc: 'configureEmail',
      call: (s) =>
        s.configureEmail({
          host: 'smtp.example.test',
          port: 587,
          secure: false,
          user: 'postmaster',
          password: 'pw',
          from: 'noreply@example.test',
        }),
      method: 'PUT',
      url: `${BASE}/email/configure`,
      body: {
        host: 'smtp.example.test',
        port: 587,
        secure: false,
        user: 'postmaster',
        password: 'pw',
        from: 'noreply@example.test',
      },
    },
    {
      desc: 'testEmail',
      call: (s) => s.testEmail('to@example.test', 'from@example.test'),
      method: 'POST',
      url: `${BASE}/email/test`,
      body: { recipient: 'to@example.test', from: 'from@example.test' },
    },

    // --- operator / owner ---
    {
      desc: 'getOperatorSummary',
      call: (s) => s.getOperatorSummary(),
      method: 'GET',
      url: `${BASE}/operator`,
    },
    {
      desc: 'createOwner',
      call: (s) => s.createOwner('Ada', 'ada@example.test', 'pw'),
      method: 'POST',
      url: `${BASE}/owner`,
      body: { name: 'Ada', email: 'ada@example.test', password: 'pw' },
    },
    {
      desc: 'saveOperator',
      call: (s) => s.saveOperator('Ada', 'ada@example.test', 'pw'),
      method: 'POST',
      url: `${BASE}/save-operator`,
      body: { name: 'Ada', email: 'ada@example.test', password: 'pw' },
    },
    {
      desc: 'activateOwner',
      call: (s) => s.activateOwner(),
      method: 'POST',
      url: `${BASE}/activate`,
      body: {},
    },
  ];

  describe.each(cases)('$desc', ({ call, method, url, body }) => {
    it(`sends ${method} ${url}`, () => {
      call(service).subscribe();

      const request = http.expectOne(url);
      expect(request.request.method).toBe(method);
      if (body !== undefined) {
        expect(request.request.body).toEqual(body);
      }
      request.flush({});
    });
  });

  it('passes the response body straight through to the caller', () => {
    const seen: unknown[] = [];
    service.getStatus().subscribe((value) => seen.push(value));

    const payload = {
      configured: true,
      phase: 'ready',
      checks: [{ name: 'db', status: 'ok', message: '' }],
      wizardStep: 3,
    };
    http.expectOne(`${BASE}/status`).flush(payload);

    expect(seen).toEqual([payload]);
  });

  it('surfaces a failing request as an error rather than swallowing it', () => {
    const errors: unknown[] = [];
    service.validate().subscribe({ error: (e) => errors.push(e) });

    http
      .expectOne(`${BASE}/validate`)
      .flush('nope', { status: 500, statusText: 'Server Error' });

    expect(errors).toHaveLength(1);
  });

  // The `?env=` branch. Each of these has a no-env case in the table above, so
  // between the two the conditional is covered in both directions.
  describe('environment-scoped requests', () => {
    const envCases: Array<{
      desc: string;
      call: (s: SetupClientService, env: string) => Observable<unknown>;
      url: string;
    }> = [
      {
        desc: 'getConfig',
        call: (s, e) => s.getConfig(e),
        url: `${BASE}/state`,
      },
      {
        desc: 'saveConfig',
        call: (s, e) => s.saveConfig({} as never, e),
        url: `${BASE}/state`,
      },
      {
        desc: 'getSettingsCatalog',
        call: (s, e) => s.getSettingsCatalog(e),
        url: `${BASE}/settings/catalog`,
      },
      {
        desc: 'getSecrets',
        call: (s, e) => s.getSecrets(e),
        url: `${BASE}/secrets`,
      },
      {
        desc: 'saveSecrets',
        call: (s, e) => s.saveSecrets({}, e),
        url: `${BASE}/secrets`,
      },
      {
        desc: 'getOAuthProviders',
        call: (s, e) => s.getOAuthProviders(e),
        url: `${BASE}/oauth/providers`,
      },
      {
        desc: 'getOAuthApps',
        call: (s, e) => s.getOAuthApps(e),
        url: `${BASE}/oauth/apps`,
      },
      {
        desc: 'testOAuthProvider',
        call: (s, e) => s.testOAuthProvider('github', e),
        url: `${BASE}/oauth/test`,
      },
      {
        desc: 'configureOAuthProvider',
        call: (s, e) =>
          s.configureOAuthProvider(
            'github',
            {
              enabled: true,
              clientId: '',
              clientSecret: '',
              redirectUri: '',
            },
            e
          ),
        url: `${BASE}/oauth/configure`,
      },
      {
        desc: 'getEmailStatus',
        call: (s, e) => s.getEmailStatus(e),
        url: `${BASE}/email/status`,
      },
      {
        desc: 'configureEmail',
        call: (s, e) =>
          s.configureEmail({ host: '', port: 0, secure: false, user: '' }, e),
        url: `${BASE}/email/configure`,
      },
      {
        desc: 'testEmail',
        call: (s, e) => s.testEmail('to@example.test', undefined, e),
        url: `${BASE}/email/test`,
      },
    ];

    it.each(envCases)('$desc appends the environment', ({ call, url }) => {
      call(service, 'staging').subscribe();

      http.expectOne(`${url}?env=staging`).flush({});
    });

    it.each(envCases)('$desc encodes the environment', ({ call, url }) => {
      call(service, 'my env/1').subscribe();

      // Unencoded this would read as a nested path and a second query param.
      http.expectOne(`${url}?env=my%20env%2F1`).flush({});
    });
  });

  describe('browseHostPath', () => {
    it('appends the path when one is given', () => {
      service.browseHostPath('/srv/deploy').subscribe();

      http.expectOne(`${BASE}/host-paths?path=%2Fsrv%2Fdeploy`).flush({});
    });

    it('omits the query for an empty path', () => {
      // '' is falsy, so it takes the same branch as no argument at all.
      service.browseHostPath('').subscribe();

      http.expectOne(`${BASE}/host-paths`).flush({});
    });
  });

  it('omits the query when the environment is an empty string', () => {
    service.getConfig('').subscribe();

    http.expectOne(`${BASE}/state`).flush({});
  });
});
