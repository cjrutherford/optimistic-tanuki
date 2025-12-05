import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  AIOrchestrationCommands,
  ProfileCommands,
} from '@optimistic-tanuki/constants';

describe('AI Orchestrator Microservice E2E Tests', () => {
  let client: ClientProxy;
  let profileClient: ClientProxy;
  let createdProfileId: string;

  beforeAll(async () => {
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: 'localhost',
        port: 3010,
      },
    });

    profileClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: 'localhost',
        port: 3002,
      },
    });

    for (let i = 0; i < 10; i++) {
      try {
        await client.connect();
        await profileClient.connect();
        console.log('Connected to services');
        break;
      } catch (err) {
        console.log(`Connection attempt ${i + 1} failed, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Create Profile
    const profileData = {
      userId: 'test-user-id-' + Date.now(),
      name: 'Test User',
      bio: 'Test Bio',
      profilePic: 'http://example.com/avatar.jpg',
      coverPic: 'http://example.com/cover.jpg',
      description: 'Test Description',
      location: 'Test Location',
      occupation: 'Test Occupation',
      interests: 'Test Interests',
      skills: 'Test Skills',
    };

    try {
      const profile = await firstValueFrom(
        profileClient.send({ cmd: ProfileCommands.Create }, profileData)
      );
      createdProfileId = profile.id;
      console.log('Created profile:', createdProfileId);
    } catch (e) {
      console.warn('Failed to create profile', e);
    }
  });

  afterAll(async () => {
    await client.close();
    await profileClient.close();
  });

  it('should initialize profile', async () => {
    if (!createdProfileId) {
      throw new Error('Profile creation failed, cannot run test');
    }

    const data = {
      profileId: createdProfileId,
      appId: 'test-app-id',
    };

    try {
      const result = await firstValueFrom(
        client.send({ cmd: AIOrchestrationCommands.PROFILE_INITIALIZE }, data)
      );
      expect(result).toEqual(data);
    } catch (error) {
      console.error('Error initializing profile:', error);
      throw error;
    }
  });
});
