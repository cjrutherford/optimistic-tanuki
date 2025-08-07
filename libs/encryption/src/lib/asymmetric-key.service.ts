/**
 * Service for asymmetric encryption and decryption using RSA key pairs.
 */
@Injectable()
export default class AsymmetricService {
  /**
   * Generates an RSA key pair.
   * @param secret Optional secret to encrypt the private key. If provided, it will be required for decryption.
   * @returns A Promise that resolves to an object containing the public and private keys in PEM format.
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
   * Encrypts data using a private key.
   * @param privKey The private key in PEM format.
   * @param value The data to be encrypted (text format only).
   * @param secret Optional secret used when creating the key pair. Required if the private key is encrypted.
   * @returns A Buffer containing the encrypted data.
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
   * Decrypts data using a public key.
   * @param pubKey The public key in PEM format.
   * @param cyText The ciphertext to be decrypted.
   * @param secret Optional secret used when creating the key pair. Required if the private key was encrypted.
   * @returns A Buffer containing the decrypted data.
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
