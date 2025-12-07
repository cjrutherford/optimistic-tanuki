import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ProjectCommands } from '@optimistic-tanuki/constants';

describe('Project Planning Microservice E2E Tests', () => {
  let client: ClientProxy;

  beforeAll(async () => {
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: '127.0.0.1',
        port: 3006,
      },
    });
    try {
      await client.connect();
    } catch (err) {
      console.warn('Could not connect to project-planning service.', err);
    }
  });

  afterAll(async () => {
    await client.close();
  });

  it('should create a project', async () => {
    const projectData = {
      owner: 'test-owner-id',
      createdBy: 'test-creator-id',
      members: ['test-member-id'],
      name: 'E2E Test Project',
      description: 'A project created by E2E tests',
      startDate: new Date(),
      status: 'active',
    };

    try {
      const result = await firstValueFrom(
        client.send({ cmd: ProjectCommands.CREATE }, projectData)
      );

      expect(result).toBeDefined();
      expect(result.name).toBe(projectData.name);
      expect(result.id).toBeDefined();
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  });

  it('should find all projects', async () => {
    try {
      const result = await firstValueFrom(
        client.send({ cmd: ProjectCommands.FIND_ALL }, {})
      );
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      console.error('Error finding all projects:', error);
      throw error;
    }
  });
});
