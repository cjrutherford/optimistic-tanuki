import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Authorization,Content-Type,X-Requested-With',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const port = process.env.ADMIN_API_PORT || 8098;
  await app.listen(port, '0.0.0.0');
  console.log(`Admin API running on http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
