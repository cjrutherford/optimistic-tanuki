import { installPayloadFreeLogging } from '@optimistic-tanuki/logger';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

export async function bootstrap() {
  installPayloadFreeLogging();
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const httpPort = Number(config.get('BOOTSTRAP_HTTP_PORT') || '3099');
  const httpHost = process.env.BOOTSTRAP_HTTP_HOST || '127.0.0.1';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: Number(config.get('listenPort')) || 3001,
    },
  });
  app.enableShutdownHooks();
  await app.startAllMicroservices();
  await app.listen(httpPort, httpHost);
  Logger.log(`Bootstrap HTTP server listening on port ${httpPort}`);
  Logger.log('Authentication microservice is listening');
}

export async function start() {
  await bootstrap();
}

const isJestRuntime =
  typeof process !== 'undefined' && process.env.JEST_WORKER_ID;

if (!isJestRuntime && require.main === module) {
  void start();
}
