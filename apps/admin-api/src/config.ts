import { registerAs } from '@nestjs/config';

export default registerAs('admin-api', () => ({
  deploymentPath:
    process.env.ADMIN_API_DEPLOYMENT_PATH ||
    './ops/deployments/production.yaml',
  secretsPath: process.env.ADMIN_API_SECRETS_PATH || './.secrets',
  workspaceRoot: process.env.ADMIN_API_WORKSPACE_ROOT || '.',
  port: parseInt(process.env.ADMIN_API_PORT || '8098', 10),
}));
