import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { PersonaTelosCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

describe('Telos Docs Microservice E2E', () => {
  let telosClient: ClientProxy;

  beforeAll(async () => {
    telosClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: globalThis.socketConnectionOptions?.host || '127.0.0.1',
        port: globalThis.socketConnectionOptions?.port || 3008,
      },
    });

    await telosClient.connect();
  });

  afterAll(async () => {
    await telosClient.close();
  });

  it('should be connected', () => {
    expect(telosClient).toBeDefined();
  });

  describe('Persona Operations', () => {
    let createdPersonaId: string;
    const testPersona = {
      name: 'Test Persona ' + Date.now(),
      role: 'Test Role',
      description: 'Test Description',
      coreObjective: 'Test Objective',
      goals: ['Goal 1'],
      skills: ['Skill 1'],
      interests: ['Interest 1'],
      limitations: ['Limitation 1'],
      strengths: ['Strength 1'],
      objectives: ['Objective 1'],
      exampleResponses: ['Example 1'],
      promptTemplate: 'Template 1',
    };

    it('should create a new persona', async () => {
      const result = await firstValueFrom(
        telosClient.send({ cmd: PersonaTelosCommands.CREATE }, testPersona)
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(testPersona.name);
      createdPersonaId = result.id;
    });

    it('should find personas', async () => {
      const result = await firstValueFrom(
        telosClient.send({ cmd: PersonaTelosCommands.FIND }, { name: testPersona.name })
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toBe(testPersona.name);
    });

    it('should find one persona by id', async () => {
      const result = await firstValueFrom(
        telosClient.send({ cmd: PersonaTelosCommands.FIND_ONE }, { id: createdPersonaId })
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(createdPersonaId);
      expect(result.name).toBe(testPersona.name);
    });

    it('should update a persona', async () => {
      const updateData = {
        id: createdPersonaId,
        name: testPersona.name + ' Updated',
      };

      const result = await firstValueFrom(
        telosClient.send({ cmd: PersonaTelosCommands.UPDATE }, updateData)
      );

      expect(result).toBeDefined();
    });

    it('should delete a persona', async () => {
      await firstValueFrom(
        telosClient.send({ cmd: PersonaTelosCommands.DELETE }, createdPersonaId),
        { defaultValue: null }
      );

      // Verify deletion
      const result = await firstValueFrom(
        telosClient.send({ cmd: PersonaTelosCommands.FIND_ONE }, { id: createdPersonaId })
      );
      expect(result).toBeNull();
    });
  });
});
