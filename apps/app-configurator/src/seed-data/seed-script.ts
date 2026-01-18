#!/usr/bin/env node

/**
 * Seed script for app-configurator
 * Creates demo configuration if it doesn't exist
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app/app.module';
import { ConfigurationsService } from '../app/configurations.service';
import { demoAppConfig } from './demo-config';

async function seed() {
  const logger = new Logger('AppConfiguratorSeed');
  
  try {
    logger.log('Starting app-configurator seeding process...');
    
    const app = await NestFactory.createApplicationContext(AppModule);
    const configurationsService = app.get(ConfigurationsService);
    
    // Check if demo configuration exists
    const existing = await configurationsService
      .getAllConfigurations()
      .then((configs) =>
        configs.find((c: any) => c.name === demoAppConfig.name)
      );

    if (!existing) {
      logger.log('Creating demo configuration...');
      await configurationsService.createConfiguration(demoAppConfig as any);
      logger.log('✓ Demo configuration created successfully');
    } else {
      logger.log('✓ Demo configuration already exists (skipping)');
    }
    
    await app.close();
    logger.log('Seeding process completed');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed demo configuration:', error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

seed();
