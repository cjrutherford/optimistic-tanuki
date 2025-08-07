import { Injectable } from "@nestjs/common";
import { createHmac, Hmac, randomBytes } from 'crypto'

/**
 * Represents a salt and hash pair.
 */
export declare type SaltHash = { salt: string, hash: string};

/**
 * Service for generating and validating salted hashes.
 */
@Injectable()
export class SaltedHashService {
    /**
     * Generates a SHA512 hash with a given salt.
     * @param pass The password to hash.
     * @param salt The salt to use for hashing.
     * @returns An object containing the salt and the generated hash.
     */
    private sha512(pass: string, salt: string): SaltHash {
        const hash: Hmac = createHmac('sha512', salt);
        hash.update(pass);
        const value = hash.digest('hex');
        return {salt, hash: value}
    }
    /**
     * Generates a random salt and hashes the password with it.
     * @param pass The password to salt and hash.
     * @returns An object containing the generated salt and hash.
     */
    private saltAndHash(pass: string): SaltHash {
        const salt = randomBytes(64).toString('hex');
        // stringify the salt in a way that's safe for database storage
        const finalSalt = salt.replace(/\0/g,'')
        return this.sha512(pass, finalSalt);
    }

    /**
     * Validates a challenge password against a stored hash and salt.
     * @param challenge The password to validate.
     * @param test The stored hash to compare against.
     * @param salt The salt used to generate the stored hash.
     * @returns True if the challenge password matches the stored hash, false otherwise.
     */
    validateHash(challenge: string, test: string, salt: string): boolean {
        return this.sha512(challenge, salt).hash === test;
    }

    /**
     * Creates a new salted hash for a given password.
     * @param password The password to hash.
     * @returns An object containing the new salt and hash.
     */
    createNewHash(password: string): SaltHash {
        return this.saltAndHash(password);
    }
    
}