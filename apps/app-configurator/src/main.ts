/**
 * App Configurator Microservice
 * Manages application configurations for multi-tenant configurable web clients
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app/app.module';
import { ConfigurationsService } from './app/configurations.service';
import { demoAppConfig } from './seed-data/demo-config';

async function bootstrap() {
  const logger = new Logger('AppConfigurator');
  const configApp = await NestFactory.createApplicationContext(AppModule);
  const config = configApp.get(ConfigService);
  
  // Seed demo configuration if it doesn't exist
  try {
    const configurationsService = configApp.get(ConfigurationsService);
    const existing = await configurationsService
      .getAllConfigurations()
      .then((configs) =>
        configs.find((c: any) => c.name === demoAppConfig.name)
      );

    if (!existing) {
      await configurationsService.createConfiguration(demoAppConfig as any);
      logger.log('✓ Demo configuration seeded');
    } else {
      logger.log('Demo configuration already exists');
    }
  } catch (error) {
    logger.error('Failed to seed demo configuration:', error.message);
  }
  
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: config.get('port') || 3010,
      },
    }
  );

  await app.listen();
  logger.log(`🚀 App Configurator Microservice is listening on port ${config.get('port') || 3010}`);
}

bootstrap();
