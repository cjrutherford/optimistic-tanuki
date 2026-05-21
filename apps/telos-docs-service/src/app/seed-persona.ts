import personas from '../assets/personas.json';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PersonaTelos } from './entities';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { upsertSeedPersonas } from './seed-persona.helpers';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const personaTelosRepo = app.get<Repository<PersonaTelos>>(
    getRepositoryToken(PersonaTelos)
  );
  const logger = app.get(Logger);

  await upsertSeedPersonas(
    personaTelosRepo,
    personas as Omit<PersonaTelos, 'id'>[],
    logger
  );
}

main().catch(console.error);
