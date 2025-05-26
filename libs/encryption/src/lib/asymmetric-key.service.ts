import { Injectable } from '@nestjs/common';
import {
  generateKeyPair,
  privateEncrypt,
  publicDecrypt,
  constants as CryptoConstants,
} from 'crypto';

@Injectable()
export default class AsymmetricService {
  /**
   *
   * @param secret string that represents the data to be used as an encryption hook. (optional, but less secure).
   * @returns Public and private keypair for use in the caller
   */
  generateKeyPair(secret?: string) {
    return new Promise<{ public: string; private: string }>(
      (resolve, reject) => {
        generateKeyPair(
          'rsa',
          {
            modulusLength: 530,
            publicExponent: 0x10101,
            publicKeyEncoding: {
              type: 'pkcs1',
              format: 'pem',
            },
            privateKeyEncoding: {
              type: 'pkcs1',
              cipher: 'aes-256-cbc',
              format: 'pem',
              passphrase: secret,
            },
          },
          (err, pub, priv) => {
            if (err) reject(err);
            resolve({ public: pub, private: priv });
          },
        );
      },
    );
  }

  /**
   *
   * @param privKey private key in which to use to encrypt the data in the value parameter.
   * @param value the data that is to be encrypted. Please text format only.
   * @param secret (Optional) Secret used when creating the key pair. (validation, required if provided at key generation.)
   * @returns
   */
  encrypt(privKey: string, value: string, secret?: string) {
    return privateEncrypt(
      {
        key: privKey,
        passphrase: secret ? secret : undefined,
        padding: CryptoConstants.RSA_PKCS1_PADDING,
      },
      Buffer.from(value),
    );
  }

  /**
   *
   * @param pubKey public key in the keypar.
   * @param cyText value to be decrypted.
   * @param secret (Optional) secret used when creating the key pair. (Validation, required if provided at key generation.)
   * @returns
   */
  decrypt(pubKey: string, cyText: string, secret?: string) {
    return publicDecrypt(
      {
        key: pubKey,
        passphrase: secret ? secret : undefined,
        padding: CryptoConstants.RSA_PKCS1_PADDING,
      },
      Buffer.from(cyText),
    ); //
  }
}
