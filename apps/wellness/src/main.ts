import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const configApp = await NestFactory.createApplicationContext(AppModule);
  const configService = configApp.get(ConfigService);
  const port = configService.get<number>('listenPort') || 3016;
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: port || 3016,
      },
    }
  );

  await app.listen();
  console.log(`🦁 Wellness microservice is running on port ${port || 3016}`);
}

bootstrap();
