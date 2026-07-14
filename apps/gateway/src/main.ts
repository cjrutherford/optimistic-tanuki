/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import {
  applyGatewaySecurityHeaders,
  enforceTrustedBrowserOrigins,
  getTrustedOrigins,
  isAllowedOrigin,
  parseConfiguredOrigins,
} from './bootstrap/security';
import { loadConfiguredRegistry } from './controllers/registry/registry.config';

async function bootstrap() {
  const registry = loadConfiguredRegistry(process.env.APP_REGISTRY_PATH);
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Enable global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not defined in DTO
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert primitive types automatically
      },
    })
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Optomisitc Tanuki API')
    .setDescription(
      "I got caught by an angry panda once, he said life's too short to be stuck working for someone else's dreams. I wonder if he ever got back home."
    )
    .setVersion('1.0')
    .addTag('authentication')
    .addTag('social')
    .addTag('timeline')
    .addTag('post')
    .addTag('timer')
    .addTag('attachment')
    .addTag('comment')
    .addTag('vote')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT || 3000;
  const configuredOrigins = parseConfiguredOrigins();
  const trustedOrigins = getTrustedOrigins({ configuredOrigins, registry });

  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(applyGatewaySecurityHeaders);
  app.use((request, response, next) =>
    enforceTrustedBrowserOrigins(request, response, next, trustedOrigins)
  );
  app.enableCors({
    origin: (origin, callback) => {
      if (
        process.env['NODE_ENV'] !== 'production' &&
        process.env['DEV_ALLOW_ALL_BROWSER_ORIGINS'] === 'true'
      ) {
        callback(null, true);
        return;
      }

      if (!origin) {
        callback(null, true);
        return;
      }

      if (isAllowedOrigin(origin, trustedOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS policy'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders:
      'Authorization,Content-Type,X-Requested-With,X-ot-appscope,X-ot-app-id',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(`📚 Swagger is running on: http://localhost:${port}/api-docs`);
}

bootstrap();
