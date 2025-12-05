import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { ProfileCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

describe('Profile Microservice E2E', () => {
  let profileClient: ClientProxy;
  let createdProfileId: string;
  const testProfile = {
    userId: `test-user-${Date.now()}`,
    username: `testuser${Date.now()}`,
    name: `Test User ${Date.now()}`,
    bio: 'Test bio for E2E testing',
    firstName: 'Test',
    lastName: 'User',
    email: `test-${Date.now()}@example.com`,
    profilePic: 'https://example.com/profile.jpg',
    coverPic: 'https://example.com/cover.jpg',
    location: 'Test City',
    occupation: 'Tester',
    interests: 'Testing, Coding',
    skills: 'Jest, NestJS',
  };

  beforeAll(async () => {
    // Create a client proxy to connect to the profile microservice
    profileClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: globalThis.socketConnectionOptions?.host || '127.0.0.1',
        port: globalThis.socketConnectionOptions?.port || 3002,
      },
    });

    // Connect to the microservice
    await profileClient.connect();
  });

  afterAll(async () => {
    // Close the connection
    await profileClient.close();
  });

  describe('Create Profile', () => {
    it('should create a new profile', async () => {
      const result = await firstValueFrom(
        profileClient.send({ cmd: ProfileCommands.Create }, testProfile)
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(testProfile.userId);
      expect(result.profileName).toBe(testProfile.name);
      expect(result.bio).toBe(testProfile.bio);
      // firstName, lastName, username are not in Profile entity

      createdProfileId = result.id;
    });

    it('should fail to create profile with duplicate userId', async () => {
      try {
        await firstValueFrom(
          profileClient.send({ cmd: ProfileCommands.Create }, testProfile)
        );
        fail('Should have thrown an error for duplicate userId');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should create another profile with different userId', async () => {
      const anotherProfile = {
        userId: `test-user-${Date.now()}-2`,
        username: `testuser${Date.now()}-2`,
        name: `Another User ${Date.now()}`,
        bio: 'Another test bio',
        firstName: 'Another',
        lastName: 'User',
        email: `test-${Date.now()}-2@example.com`,
        profilePic: 'https://example.com/profile2.jpg',
        coverPic: 'https://example.com/cover2.jpg',
        location: 'Another City',
        occupation: 'Another Tester',
        interests: 'More Testing',
        skills: 'More Jest',
      };

      const result = await firstValueFrom(
        profileClient.send({ cmd: ProfileCommands.Create }, anotherProfile)
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(anotherProfile.userId);
    });
  });

  describe('Get Profile', () => {
    it('should get profile by id', async () => {
      const result = await firstValueFrom(
        profileClient.send(
          { cmd: ProfileCommands.Get },
          {
            id: createdProfileId,
            query: {},
          }
        )
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(createdProfileId);
      expect(result.userId).toBe(testProfile.userId);
      expect(result.profileName).toBe(testProfile.name);
    });

    it('should return null for non-existent profile', async () => {
      const result = await firstValueFrom(
        profileClient.send(
          { cmd: ProfileCommands.Get },
          {
            id: '00000000-0000-0000-0000-000000000000',
            query: {},
          }
        )
      );

      expect(result).toBeNull();
    });
  });

  describe('Get All Profiles', () => {
    it('should get all profiles', async () => {
      const result = await firstValueFrom(
        profileClient.send({ cmd: ProfileCommands.GetAll }, {})
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Verify our created profile is in the list
      const foundProfile = result.find((p: any) => p.id === createdProfileId);
      expect(foundProfile).toBeDefined();
    });

    it('should get profiles with query filters', async () => {
      const result = await firstValueFrom(
        profileClient.send(
          { cmd: ProfileCommands.GetAll },
          {
            where: { userId: testProfile.userId },
          }
        )
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].userId).toBe(testProfile.userId);
    });
  });

  describe('Update Profile', () => {
    it('should update profile bio', async () => {
      const updatedBio = 'Updated bio for E2E testing';
      const result = await firstValueFrom(
        profileClient.send(
          { cmd: ProfileCommands.Update },
          {
            id: createdProfileId,
            bio: updatedBio,
          }
        )
      );

      expect(result).toBeDefined();
      expect(result.bio).toBe(updatedBio);
      expect(result.id).toBe(createdProfileId);
    });

    it('should update profile name', async () => {
      const updatedName = `Updated User ${Date.now()}`;
      const result = await firstValueFrom(
        profileClient.send(
          { cmd: ProfileCommands.Update },
          {
            id: createdProfileId,
            name: updatedName,
          }
        )
      );

      expect(result).toBeDefined();
      expect(result.profileName).toBe(updatedName);
    });

    it('should update multiple profile fields', async () => {
      const updates = {
        id: createdProfileId,
        location: 'Updated City',
        occupation: 'Updated Occupation',
        bio: 'Final updated bio',
      };

      const result = await firstValueFrom(
        profileClient.send({ cmd: ProfileCommands.Update }, updates)
      );

      expect(result).toBeDefined();
      expect(result.location).toBe(updates.location);
      expect(result.occupation).toBe(updates.occupation);
      expect(result.bio).toBe(updates.bio);
    });

    it('should fail to update non-existent profile', async () => {
      try {
        await firstValueFrom(
          profileClient.send(
            { cmd: ProfileCommands.Update },
            {
              id: '00000000-0000-0000-0000-000000000000',
              bio: 'This should fail',
            }
          )
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
