import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../../gateway/src/auth/auth.guard';
import { AccountExportDownloadController } from '../../../gateway/src/controllers/authentication/account-export-download.controller';
import { GATEWAY_APP_REGISTRY } from '../../../gateway/src/controllers/registry/registry.tokens';
import { MicroserviceExceptionFilter } from '../../../gateway/src/filters/microservice-exception.filter';

const port = process.env.A07_HTTP_PORT;
if (
  process.env.A07_PRIVATE_MARKER !== 'private-a07-artifact-v1' ||
  !process.send ||
  port !== '14880' ||
  !process.env.A07_JWT_SECRET
)
  throw new Error('PRIVATE_A07_WORKER_REQUIRED');

const auth = ClientProxyFactory.create({
  transport: Transport.TCP,
  options: { host: '127.0.0.1', port: 14801 },
});
const permissions = ClientProxyFactory.create({
  transport: Transport.TCP,
  options: { host: '127.0.0.1', port: 14812 },
});
const registry = {
  apps: [
    {
      appId: 'client-interface',
      uiBaseUrl: 'http://127.0.0.1:14881',
      apiBaseUrl: 'http://127.0.0.1:14880',
    },
    {
      appId: 'local-hub',
      uiBaseUrl: 'http://127.0.0.1:14883',
      apiBaseUrl: 'http://127.0.0.1:14880',
    },
  ],
};

@Module({
  controllers: [AccountExportDownloadController],
  providers: [
    AuthGuard,
    Reflector,
    {
      provide: JwtService,
      useValue: new JwtService({ secret: process.env.A07_JWT_SECRET }),
    },
    { provide: ServiceTokens.AUTHENTICATION_SERVICE, useValue: auth },
    { provide: ServiceTokens.PERMISSIONS_SERVICE, useValue: permissions },
    { provide: GATEWAY_APP_REGISTRY, useValue: registry },
  ],
})
class A07DownloadGatewayModule {}

async function bootstrap() {
  const app = await NestFactory.create(A07DownloadGatewayModule, {
    logger: false,
  });
  app.setGlobalPrefix('api');
  app.use((request: any, _response: any, next: () => void) => {
    const cookies: Record<string, string> = {};
    for (const item of String(request.headers.cookie || '').split(';')) {
      const at = item.indexOf('=');
      if (at <= 0) continue;
      const key = item.slice(0, at).trim();
      const value = item.slice(at + 1).trim();
      if (/^[A-Za-z0-9_-]+$/.test(key) && value.length < 4096) {
        try {
          cookies[key] = decodeURIComponent(value);
        } catch {
          /* ignore malformed cookie */
        }
      }
    }
    request.cookies = cookies;
    next();
  });
  app.useGlobalFilters(new MicroserviceExceptionFilter());
  await app.listen(14880, '127.0.0.1');
  process.send?.({ ready: true, pid: process.pid });
  process.on('message', async (message) => {
    if ((message as any)?.type !== 'shutdown') return;
    await app.close();
    auth.close();
    permissions.close();
    process.exit(0);
  });
}

bootstrap().catch(() => {
  auth.close();
  permissions.close();
  process.send?.({ error: 'A07_WORKER_STARTUP_FAILED' });
  process.exit(1);
});
