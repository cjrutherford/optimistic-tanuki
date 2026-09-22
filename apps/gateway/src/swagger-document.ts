import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * O15a: single source for the gateway OpenAPI document — served at
 * `/api-docs` by `main.ts` and exported to `dist/openapi.json` by the
 * `get-openapi` script for orval codegen. Edit tags/routes here once, not in
 * both places.
 */
export function buildSwaggerDocument(app: INestApplication) {
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
  return SwaggerModule.createDocument(app, config);
}
