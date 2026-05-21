import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PersonaTelos } from './entities';
import { upsertSeedPersonas } from './seed-persona.helpers';

describe('upsertSeedPersonas', () => {
  const seedPersona = {
    name: 'Alex Generalis',
    description: 'Updated description',
    goals: ['Assist'],
    skills: ['Research'],
    interests: ['Productivity'],
    limitations: ['None'],
    strengths: ['Reliable'],
    objectives: ['Help'],
    coreObjective: 'Be helpful',
    exampleResponses: ['How can I help?'],
    promptTemplate: 'You are helpful.',
  };

  let repository: Pick<
    Repository<PersonaTelos>,
    'findOneBy' | 'create' | 'save'
  >;
  let logger: Pick<Logger, 'log'>;

  beforeEach(() => {
    const create = jest.fn(
      (value: Partial<PersonaTelos>) => value as PersonaTelos
    );
    const save = jest.fn(
      async (value: Partial<PersonaTelos>) => value as PersonaTelos
    );
    repository = {
      findOneBy: jest.fn(),
      create: create as unknown as Repository<PersonaTelos>['create'],
      save: save as unknown as Repository<PersonaTelos>['save'],
    } as Pick<Repository<PersonaTelos>, 'findOneBy' | 'create' | 'save'>;
    logger = {
      log: jest.fn(),
    };
  });

  it('creates a missing persona from the seed data', async () => {
    (repository.findOneBy as jest.Mock).mockResolvedValue(null);

    await upsertSeedPersonas(repository, [seedPersona], logger);

    expect(repository.create as jest.Mock).toHaveBeenCalledWith(seedPersona);
    expect(repository.save as jest.Mock).toHaveBeenCalledWith(seedPersona);
    expect(logger.log).toHaveBeenCalledWith(
      'Created new persona: Alex Generalis'
    );
  });

  it('updates an existing seeded persona when the source data changes', async () => {
    (repository.findOneBy as jest.Mock).mockResolvedValue({
      id: 'persona-1',
      name: 'Alex Generalis',
      description: 'Old description',
    } as PersonaTelos);

    await upsertSeedPersonas(repository, [seedPersona], logger);

    expect(repository.create as jest.Mock).not.toHaveBeenCalled();
    expect(repository.save as jest.Mock).toHaveBeenCalledWith({
      id: 'persona-1',
      name: 'Alex Generalis',
      description: 'Updated description',
      goals: ['Assist'],
      skills: ['Research'],
      interests: ['Productivity'],
      limitations: ['None'],
      strengths: ['Reliable'],
      objectives: ['Help'],
      coreObjective: 'Be helpful',
      exampleResponses: ['How can I help?'],
      promptTemplate: 'You are helpful.',
    });
    expect(logger.log).toHaveBeenCalledWith(
      'Updated existing persona: Alex Generalis'
    );
  });
});
