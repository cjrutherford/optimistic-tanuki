import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';

async function bootstrap() {
  // Default 3019: the old 3024 default collided with the workspace and
  // learning-service container ports. Overridable via BILLING_PORT, which the
  // gateway also honors as the `billing` service port override.
  const port = Number(process.env['BILLING_PORT'] || 3019);
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: process.env['BILLING_HOST'] || '0.0.0.0',
        port,
      },
    }
  );

  // O16 (Track B): same pipe settings as the gateway (`apps/gateway/src/main.ts`)
  // so malformed TCP payloads reject here too. Union/inline handler params
  // (design metatype Object) are skipped by the pipe — those handlers either
  // use real DTO classes (see app.controller.ts) or validate explicitly.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  await app.listen();
  Logger.log(`Billing microservice listening on port ${port}`);
}

bootstrap();
