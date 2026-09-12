#!/usr/bin/env node

/**
 * Seed script for app-configurator
 * Creates demo configuration if it doesn't exist
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app/app.module';
import { ConfigurationsService } from '../app/configurations.service';
import { resolveAppConfigSeedContext } from './seed-context';
import { seedDemoConfiguration } from './seed-helper';

async function seed() {
  const logger = new Logger('AppConfiguratorSeed');

  try {
    logger.log('Starting app-configurator seeding process...');

    const app = await NestFactory.createApplicationContext(AppModule);
    const configurationsService = app.get(ConfigurationsService);
    const context = resolveAppConfigSeedContext();

    if (!context) {
      logger.warn(
        'Skipping demo configuration seed: complete app context is required'
      );
      await app.close();
      process.exit(0);
    }

    const { created, configurations: finalConfigs } =
      await seedDemoConfiguration(configurationsService, context, logger);
    logger.log('✓ Demo configuration is ready');
    logger.log(`  - ID: ${created.id}`);
    logger.log(`  - Name: ${created.name}`);
    logger.log(`Total configurations after seeding: ${finalConfigs.length}`);
    finalConfigs.forEach((config: any) => {
      logger.log(
        `  - ${config.name} (id: ${config.id}, active: ${config.active})`
      );
    });

    await app.close();
    logger.log('Seeding process completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed demo configuration:', error.message);
    logger.error('Error details:', error);
    if (error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

seed();
