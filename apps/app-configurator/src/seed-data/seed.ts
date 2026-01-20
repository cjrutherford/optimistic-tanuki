import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app/app.module';
import { ConfigurationsService } from '../app/configurations.service';
import { demoAppConfig } from './demo-config';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const configurationsService = app.get(ConfigurationsService);

  try {
    const existing = await configurationsService
      .getAllConfigurations()
      .then((configs) =>
        configs.find((c: any) => c.name === demoAppConfig.name)
      );

    if (existing) {
      console.log('Demo configuration already exists');
      await app.close();
      return;
    }

    await configurationsService.createConfiguration(demoAppConfig as any);
    console.log('✓ Demo configuration created');
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
