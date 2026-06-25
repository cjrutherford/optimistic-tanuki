import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

export async function bootstrap() {
  const configApp = await NestFactory.create(AppModule);
  const config = configApp.get(ConfigService);

  const httpApp = await NestFactory.create(AppModule);
  const httpPort = Number(config.get('BOOTSTRAP_HTTP_PORT') || '3099');
  await httpApp.listen(httpPort);
  Logger.log(`Bootstrap HTTP server listening on port ${httpPort}`);

  const microserviceApp =
    await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: Number(config.get('listenPort')) || 3001,
      },
    });
  await microserviceApp.listen();
  Logger.log(
    'Microservice is listening On Port: ' + (config.get('listenPort') || 3001)
  );
}

export async function start() {
  await bootstrap();
}

const isJestRuntime =
  typeof process !== 'undefined' && process.env.JEST_WORKER_ID;

if (!isJestRuntime && require.main === module) {
  void start();
}
