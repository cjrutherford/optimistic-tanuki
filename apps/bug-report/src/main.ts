import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 3MB JSON limit: screenshot inline base64 (~2MB max) + logs.
  app.use(json({ limit: '3mb' }));

  const allowed = (process.env['BUG_REPORT_ALLOWED_ORIGINS'] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowed.length > 0 ? allowed : true,
    methods: ['GET', 'POST'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Controller paths already include `api/bug-reports`; no global prefix.
  const port = Number(process.env['BUG_REPORT_PORT'] || 3025);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Bug-report service listening on port ${port}`);
}

bootstrap();
