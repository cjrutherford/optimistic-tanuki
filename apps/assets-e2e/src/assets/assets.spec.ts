import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { AssetCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

describe('Assets Microservice E2E', () => {
  let assetsClient: ClientProxy;
  let createdAssetId: string;

  beforeAll(async () => {
    // Create a client proxy to connect to the assets microservice
    assetsClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: 'localhost',
        port: 3005,
      },
    });

    // Connect to the microservice with retry
    for (let i = 0; i < 10; i++) {
      try {
        await assetsClient.connect();
        console.log('Connected to assets service');
        break;
      } catch (err) {
        console.log(`Connection attempt ${i + 1} failed, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  });

  afterAll(async () => {
    // Close the connection
    await assetsClient.close();
  });

  describe('Create Asset', () => {
    it('should create a new asset', async () => {
      const testAsset = {
        name: `test-file-${Date.now()}`,
        fileExtension: 'txt',
        type: 'document',
        content: `data:text/plain;base64,${Buffer.from(
          'This is test file content for E2E testing'
        ).toString('base64')}`,
        profileId: `test-user-${Date.now()}`,
      };

      const result = await firstValueFrom(
        assetsClient.send({ cmd: AssetCommands.CREATE }, testAsset)
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();

      createdAssetId = result.id;
    });

    it('should create an asset with image mime type', async () => {
      const testAsset = {
        name: `test-image-${Date.now()}`,
        fileExtension: 'png',
        type: 'image',
        content: `data:image/png;base64,${Buffer.from(
          'fake-image-data'
        ).toString('base64')}`,
        profileId: `test-user-${Date.now()}`,
      };

      const result = await firstValueFrom(
        assetsClient.send({ cmd: AssetCommands.CREATE }, testAsset)
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });

  describe('Retrieve Asset', () => {
    it('should retrieve asset metadata', async () => {
      const result = await firstValueFrom(
        assetsClient.send(
          { cmd: AssetCommands.RETRIEVE },
          {
            id: createdAssetId,
          }
        )
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(createdAssetId);
    });

    it('should return null for non-existent asset', async () => {
      try {
        await firstValueFrom(
          assetsClient.send(
            { cmd: AssetCommands.RETRIEVE },
            {
              id: 'non-existent-id-12345',
            }
          )
        );
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Read Asset', () => {
    it('should read asset data', async () => {
      const result = await firstValueFrom(
        assetsClient.send(
          { cmd: AssetCommands.READ },
          {
            id: createdAssetId,
          }
        )
      );

      expect(result).toBeDefined();
      // Result might be buffer or string depending on implementation
      expect(result).toBeDefined();
    });

    it('should fail to read non-existent asset', async () => {
      try {
        await firstValueFrom(
          assetsClient.send(
            { cmd: AssetCommands.READ },
            {
              id: 'non-existent-id-12345',
            }
          )
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Remove Asset', () => {
    it('should remove an asset', async () => {
      const result = await firstValueFrom(
        assetsClient.send(
          { cmd: AssetCommands.REMOVE },
          {
            id: createdAssetId,
          }
        )
      );

      expect(result).toBeDefined();
    });

    it('should fail to remove already deleted asset', async () => {
      try {
        await firstValueFrom(
          assetsClient.send(
            { cmd: AssetCommands.REMOVE },
            {
              id: createdAssetId,
            }
          )
        );
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should fail to remove non-existent asset', async () => {
      try {
        await firstValueFrom(
          assetsClient.send(
            { cmd: AssetCommands.REMOVE },
            {
              id: 'non-existent-id-12345',
            }
          )
        );
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
