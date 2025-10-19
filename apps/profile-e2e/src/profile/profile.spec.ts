import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ProfileCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

describe('Profile Microservice E2E', () => {
  let profileClient: ClientProxy;
  let createdProfileId: string;
  const testProfile = {
    userId: `test-user-${Date.now()}`,
    username: `testuser${Date.now()}`,
    bio: 'Test bio for E2E testing',
    firstName: 'Test',
    lastName: 'User',
    email: `test-${Date.now()}@example.com`,
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
      expect(result.username).toBe(testProfile.username);
      expect(result.bio).toBe(testProfile.bio);
      expect(result.firstName).toBe(testProfile.firstName);
      expect(result.lastName).toBe(testProfile.lastName);

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
        bio: 'Another test bio',
        firstName: 'Another',
        lastName: 'User',
        email: `test-${Date.now()}-2@example.com`,
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
        profileClient.send({ cmd: ProfileCommands.Get }, {
          id: createdProfileId,
          query: {},
        })
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(createdProfileId);
      expect(result.userId).toBe(testProfile.userId);
      expect(result.username).toBe(testProfile.username);
    });

    it('should return null for non-existent profile', async () => {
      const result = await firstValueFrom(
        profileClient.send({ cmd: ProfileCommands.Get }, {
          id: 'non-existent-id-12345',
          query: {},
        })
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
        profileClient.send({ cmd: ProfileCommands.GetAll }, {
          where: { userId: testProfile.userId },
        })
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
        profileClient.send({ cmd: ProfileCommands.Update }, {
          id: createdProfileId,
          bio: updatedBio,
        })
      );

      expect(result).toBeDefined();
      expect(result.bio).toBe(updatedBio);
      expect(result.id).toBe(createdProfileId);
    });

    it('should update profile username', async () => {
      const updatedUsername = `updateduser${Date.now()}`;
      const result = await firstValueFrom(
        profileClient.send({ cmd: ProfileCommands.Update }, {
          id: createdProfileId,
          username: updatedUsername,
        })
      );

      expect(result).toBeDefined();
      expect(result.username).toBe(updatedUsername);
    });

    it('should update multiple profile fields', async () => {
      const updates = {
        id: createdProfileId,
        firstName: 'Updated',
        lastName: 'Name',
        bio: 'Final updated bio',
      };

      const result = await firstValueFrom(
        profileClient.send({ cmd: ProfileCommands.Update }, updates)
      );

      expect(result).toBeDefined();
      expect(result.firstName).toBe(updates.firstName);
      expect(result.lastName).toBe(updates.lastName);
      expect(result.bio).toBe(updates.bio);
    });

    it('should fail to update non-existent profile', async () => {
      try {
        await firstValueFrom(
          profileClient.send({ cmd: ProfileCommands.Update }, {
            id: 'non-existent-id-12345',
            bio: 'This should fail',
          })
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
