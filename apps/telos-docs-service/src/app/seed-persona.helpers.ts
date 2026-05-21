import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PersonaTelos } from './entities';

type SeedPersonaInput = Omit<PersonaTelos, 'id'>;

export async function upsertSeedPersonas(
  personaTelosRepo: Pick<
    Repository<PersonaTelos>,
    'findOneBy' | 'create' | 'save'
  >,
  personas: SeedPersonaInput[],
  logger?: Pick<Logger, 'log'>
): Promise<void> {
  for (const persona of personas) {
    const existingPersona = await personaTelosRepo.findOneBy({
      name: persona.name,
    });

    if (existingPersona) {
      await personaTelosRepo.save({
        ...existingPersona,
        ...persona,
      });
      logger?.log(`Updated existing persona: ${persona.name}`);
      continue;
    }

    const newPersona = personaTelosRepo.create(persona);
    await personaTelosRepo.save(newPersona);
    logger?.log(`Created new persona: ${persona.name}`);
  }
}
