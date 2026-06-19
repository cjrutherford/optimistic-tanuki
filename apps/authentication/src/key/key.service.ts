import { Injectable, Logger } from '@nestjs/common';
import { AsymmetricService } from '@optimistic-tanuki/encryption';

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';

@Injectable()
export class KeyService {
  private readonly logger = new Logger(
    'Authentication Service | Key -> KeyService'
  );
  constructor(private readonly keyService: AsymmetricService) {}

  private getCacheLocation() {
    return process.env['AUTH_KEY_CACHE_DIR'] || join(tmpdir(), 'ot-auth-keys');
  }

  async generateUserKeys(userId: string, hash: string) {
    try {
      const { private: privKey, public: pubKey } =
        await this.keyService.generateKeyPair(hash);
      // STORE THE PRIVATE KEY FOR DELIVERY THROUGH OTHER MEANS.
      const cacheLocation = this.getCacheLocation();
      if (!existsSync(cacheLocation)) {
        mkdirSync(cacheLocation, { recursive: true });
      }
      const privLocation = join(cacheLocation, `${userId}.priv`);
      await writeFile(privLocation, privKey, 'utf-8');
      // RETURN THE PUBLIC KEY SO THAT IT CAN BE USED IN THE APPLICATION.
      // RETURN URL FOR PRIVATE KEY.
      return { pubKey, privLocation };
    } catch (e) {
      this.logger.error(
        `Unable to generate user keys for ${userId}: ${e.message}`,
        e.stack
      );
      throw new Error('Failed to generate keys.');
    }
  }
}
