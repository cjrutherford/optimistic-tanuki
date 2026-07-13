import * as fs from 'fs';
import * as path from 'path';

describe('production OAuth secret wiring', () => {
  const workspaceRoot = path.resolve(__dirname, '../../..');
  const oauthKeys = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GITHUB_REDIRECT_URI',
    'MICROSOFT_CLIENT_ID',
    'MICROSOFT_CLIENT_SECRET',
    'MICROSOFT_REDIRECT_URI',
    'FACEBOOK_CLIENT_ID',
    'FACEBOOK_CLIENT_SECRET',
    'FACEBOOK_REDIRECT_URI',
  ];

  it('documents, generates, and injects provider values only into gateway', () => {
    const secretsExample = fs.readFileSync(
      path.join(workspaceRoot, '.secrets.example'),
      'utf8'
    );
    const generator = fs.readFileSync(
      path.join(workspaceRoot, 'scripts/generate-secrets.sh'),
      'utf8'
    );
    const gateway = fs.readFileSync(
      path.join(workspaceRoot, 'k8s/base/gateway.yaml'),
      'utf8'
    );
    const authentication = fs.readFileSync(
      path.join(workspaceRoot, 'k8s/base/services/authentication.yaml'),
      'utf8'
    );
    const sharedSecret = fs.readFileSync(
      path.join(workspaceRoot, 'k8s/base/secrets.yaml'),
      'utf8'
    );
    const gatewayOAuthSecret = fs.readFileSync(
      path.join(workspaceRoot, 'k8s/base/gateway-oauth-secrets.yaml'),
      'utf8'
    );
    const productionDeploy = fs.readFileSync(
      path.join(workspaceRoot, 'scripts/deploy-production.sh'),
      'utf8'
    );

    for (const key of oauthKeys) {
      expect(secretsExample).toContain(`${key}=`);
      expect(generator).toContain(`${key}=`);
      expect(generator).toContain(`${key}: \${${key}}`);
      expect(gateway).toContain(`- name: ${key}`);
      expect(gateway).toContain(`key: ${key}`);
      expect(authentication).not.toContain(`- name: ${key}`);
      expect(sharedSecret).not.toContain(`${key}:`);
      expect(gatewayOAuthSecret).toContain(`${key}:`);
    }
    expect(gateway).toContain('name: gateway-oauth-secrets');
    expect(authentication).not.toContain('gateway-oauth-secrets');
    expect(productionDeploy).toContain('gateway-oauth-secrets.yaml');
    expect(productionDeploy).toContain('apply -f "$GATEWAY_OAUTH_SECRET_FILE"');
  });
});
