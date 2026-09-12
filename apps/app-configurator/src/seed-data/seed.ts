import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app/app.module';
import { ConfigurationsService } from '../app/configurations.service';
import { demoAppConfigForScope } from './demo-config';
import { resolveAppConfigSeedContext } from './seed-context';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const configurationsService = app.get(ConfigurationsService);
  const context = resolveAppConfigSeedContext();

  try {
    if (!context) {
      console.log(
        'Skipping demo configuration seed: bootstrap owner identity is not configured'
      );
      return;
    }
    const demoAppConfig = demoAppConfigForScope(
      context.appScope,
      process.env.APP_CONFIG_SEED_BLOG_CATALOG_ID
    );
    const existing = await configurationsService
      .getAllConfigurations(context)
      .then((configs) =>
        configs.find((c: any) => c.name === demoAppConfig.name)
      );

    if (existing) {
      console.log('Demo configuration already exists');
      await app.close();
      return;
    }

    await configurationsService.createConfiguration(
      demoAppConfig as any,
      context
    );
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
