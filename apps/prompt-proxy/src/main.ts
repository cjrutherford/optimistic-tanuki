import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const configApp = await NestFactory.create(AppModule);
  const configService = configApp.get(ConfigService);
  const port = configService.get<number>('listenPort', 3009);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,    
    {
      transport: Transport.TCP,
      options: { host: '0.0.0.0', port },
    }
  );

  await app.listen();
  Logger.log(`🚀 Microservice is running on: tcp://localhost:${port}`);
}

bootstrap();
