import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const port = Number(process.env['BILLING_PORT'] || 3024);
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: process.env['BILLING_HOST'] || '0.0.0.0',
        port,
      },
    },
  );

  await app.listen();
  Logger.log(`Billing microservice listening on port ${port}`);
}

bootstrap();
