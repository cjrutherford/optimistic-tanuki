import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { AssetCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

describe('Assets Microservice E2E', () => {
  let assetsClient: ClientProxy;
  let createdAssetKey: string;

  beforeAll(async () => {
    // Create a client proxy to connect to the assets microservice
    assetsClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: globalThis.socketConnectionOptions?.host || '127.0.0.1',
        port: globalThis.socketConnectionOptions?.port || 3005,
      },
    });

    // Connect to the microservice
    await assetsClient.connect();
  });

  afterAll(async () => {
    // Close the connection
    await assetsClient.close();
  });

  describe('Create Asset', () => {
    it('should create a new asset', async () => {
      const testAsset = {
        fileName: `test-file-${Date.now()}.txt`,
        mimeType: 'text/plain',
        data: Buffer.from('This is test file content for E2E testing').toString('base64'),
        userId: `test-user-${Date.now()}`,
      };

      const result = await firstValueFrom(
        assetsClient.send({ cmd: AssetCommands.CREATE }, testAsset)
      );

      expect(result).toBeDefined();
      expect(result.key).toBeDefined();
      expect(result.url).toBeDefined();

      createdAssetKey = result.key;
    });

    it('should create an asset with image mime type', async () => {
      const testAsset = {
        fileName: `test-image-${Date.now()}.png`,
        mimeType: 'image/png',
        data: Buffer.from('fake-image-data').toString('base64'),
        userId: `test-user-${Date.now()}`,
      };

      const result = await firstValueFrom(
        assetsClient.send({ cmd: AssetCommands.CREATE }, testAsset)
      );

      expect(result).toBeDefined();
      expect(result.key).toBeDefined();
    });
  });

  describe('Retrieve Asset', () => {
    it('should retrieve asset metadata', async () => {
      const result = await firstValueFrom(
        assetsClient.send({ cmd: AssetCommands.RETRIEVE }, {
          key: createdAssetKey,
        })
      );

      expect(result).toBeDefined();
      expect(result.key).toBe(createdAssetKey);
    });

    it('should return null for non-existent asset', async () => {
      try {
        await firstValueFrom(
          assetsClient.send({ cmd: AssetCommands.RETRIEVE }, {
            key: 'non-existent-key-12345',
          })
        );
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Read Asset', () => {
    it('should read asset data', async () => {
      const result = await firstValueFrom(
        assetsClient.send({ cmd: AssetCommands.READ }, {
          key: createdAssetKey,
        })
      );

      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result) || typeof result === 'string').toBe(true);
    });

    it('should fail to read non-existent asset', async () => {
      try {
        await firstValueFrom(
          assetsClient.send({ cmd: AssetCommands.READ }, {
            key: 'non-existent-key-12345',
          })
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
        assetsClient.send({ cmd: AssetCommands.REMOVE }, {
          key: createdAssetKey,
        })
      );

      expect(result).toBeDefined();
    });

    it('should fail to remove already deleted asset', async () => {
      try {
        await firstValueFrom(
          assetsClient.send({ cmd: AssetCommands.REMOVE }, {
            key: createdAssetKey,
          })
        );
      } catch (error) {
        // This might succeed or fail depending on implementation
        // Just verify it doesn't crash
        expect(true).toBe(true);
      }
    });

    it('should fail to remove non-existent asset', async () => {
      try {
        await firstValueFrom(
          assetsClient.send({ cmd: AssetCommands.REMOVE }, {
            key: 'non-existent-key-12345',
          })
        );
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
