import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createFoundationDataSource } from '@optimistic-tanuki/civic-core';
import { AppModule } from './app/app.module';
import loadConfig, { databaseUrl } from './config';

async function bootstrap() {
  const config = loadConfig();

  // Until the generated migration lands (P2.2), an empty database gets the
  // foundation schema from the entity definitions, as the POC did.
  await (await createFoundationDataSource(databaseUrl(config))).destroy();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: Number(config.listenPort) || 3028,
      },
    }
  );

  await app.listen().then(() => {
    Logger.log(
      'Civic briefing microservice listening on port: ' +
        (config.listenPort || 3028)
    );
  });
}

bootstrap();
