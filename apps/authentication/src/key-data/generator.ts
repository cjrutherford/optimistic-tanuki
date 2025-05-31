import * as crypto from 'crypto';
import * as fs from 'fs';

class KeyGenerator {
    privateKeyPath: string;

    constructor(privateKeyPath: string) {
        this.privateKeyPath = privateKeyPath;
    }

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

    loadPrivateKey() {
        return fs.readFileSync(this.privateKeyPath, 'utf8');
    }

    generateSalt() {
        return crypto.randomBytes(16).toString('hex');
    }
}

export default KeyGenerator;