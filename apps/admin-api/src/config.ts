import { registerAs } from '@nestjs/config';

export default registerAs('admin-api', () => ({
  deploymentPath:
    process.env.ADMIN_API_DEPLOYMENT_PATH ||
    './ops/deployments/production.yaml',
  secretsPath: process.env.ADMIN_API_SECRETS_PATH || './.secrets',
  workspaceRoot: process.env.ADMIN_API_WORKSPACE_ROOT || '.',
  gatewayBaseUrl:
    process.env.ADMIN_API_GATEWAY_URL ||
    process.env.GATEWAY_URL ||
    'http://gateway:3000',
  services: {
    authentication: {
      host: process.env.AUTHENTICATION_HOST || 'authentication',
      port: parseInt(process.env.AUTHENTICATION_PORT || '3001', 10),
    },
    profile: {
      host: process.env.PROFILE_HOST || 'profile',
      port: parseInt(process.env.PROFILE_PORT || '3002', 10),
    },
    permissions: {
      host: process.env.PERMISSIONS_HOST || 'permissions',
      port: parseInt(process.env.PERMISSIONS_PORT || '3012', 10),
    },
  },
  port: parseInt(process.env.ADMIN_API_PORT || '8098', 10),
}));
