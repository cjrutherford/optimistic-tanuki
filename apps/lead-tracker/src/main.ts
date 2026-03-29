import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const configApp = await NestFactory.create(AppModule);
  const config = configApp.get(ConfigService);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: Number(config.get('listenPort')) || 3020,
      },
    }
  );

  await app.listen().then(() => {
    Logger.log(
      'Lead Tracker microservice listening on port: ' +
        (config.get('listenPort') || 3020)
    );
  });
}

bootstrap();
