import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * A utility class for generating and managing cryptographic keys.
 */
class KeyGenerator {
    privateKeyPath: string;

    /**
     * Creates an instance of KeyGenerator.
     * @param privateKeyPath The path where the private key will be stored.
     */
    constructor(privateKeyPath: string) {
        this.privateKeyPath = privateKeyPath;
    }

    /**
     * Generates a new RSA key pair.
     * The private key is stored to a file, and the public key is returned.
     * @returns An object containing the path to the private key and the public key.
     */
    generateKeys() {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 4096, // Increased modulus length for better security
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });

        // Store the private key to a file
        fs.writeFileSync(this.privateKeyPath, privateKey);

        // Return the public key
        return {priv: this.privateKeyPath, pub: publicKey};
    }

    /**
     * Loads the private key from the specified path.
     * @returns The private key as a UTF-8 string.
     */
    loadPrivateKey() {
        return fs.readFileSync(this.privateKeyPath, 'utf8');
    }

    /**
     * Generates a random salt.
     * @returns A 16-byte random salt as a hexadecimal string.
     */
    generateSalt() {
        return crypto.randomBytes(16).toString('hex');
    }
}

export default KeyGenerator;