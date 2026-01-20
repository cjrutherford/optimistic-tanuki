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
    const allConfigs = await configurationsService.getAllConfigurations();
    logger.log(`Found ${allConfigs.length} configurations in database`);
    
    const existing = allConfigs.find((c: any) => c.name === demoAppConfig.name);

    if (!existing) {
      logger.log(`Creating demo configuration with name: ${demoAppConfig.name}...`);
      const created = await configurationsService.createConfiguration(demoAppConfig as any);
      logger.log('✓ Demo configuration created successfully');
      logger.log(`  - ID: ${created.id}`);
      logger.log(`  - Name: ${created.name}`);
    } else {
      logger.log(`✓ Demo configuration already exists (name: ${existing.name}, id: ${existing.id})`);
    }
    
    // Log all configurations for debugging
    const finalConfigs = await configurationsService.getAllConfigurations();
    logger.log(`Total configurations after seeding: ${finalConfigs.length}`);
    finalConfigs.forEach((config: any) => {
      logger.log(`  - ${config.name} (id: ${config.id}, active: ${config.active})`);
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
