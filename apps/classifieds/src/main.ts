import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const configApp = await NestFactory.createApplicationContext(AppModule);
  const configService = configApp.get(ConfigService);
  const port = configService.get<number>('listenPort') || 3017;
  await configApp.close();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: port || 3017,
      },
    }
  );

  await app.listen();
  console.log(`🏪 Classifieds microservice is running on port ${port || 3017}`);
}

bootstrap();
