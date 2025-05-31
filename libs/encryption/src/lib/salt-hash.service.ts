import { Injectable } from "@nestjs/common";
import { createHmac, Hmac, randomBytes } from 'crypto'

export declare type SaltHash = { salt: string, hash: string};


@Injectable()
export class SaltedHashService {
    private sha512(pass: string, salt: string): SaltHash {
        const hash: Hmac = createHmac('sha512', salt);
        hash.update(pass);
        const value = hash.digest('hex');
        return {salt, hash: value}
    }
    private saltAndHash(pass: string): SaltHash {
        const salt = randomBytes(64).toString('hex');
        // stringify the salt in a way that's safe for database storage
        const finalSalt = salt.replace(/\0/g,'')
        return this.sha512(pass, finalSalt);
    }

    validateHash(challenge: string, test: string, salt: string): boolean {
        return this.sha512(challenge, salt).hash === test;
    }

    createNewHash(password: string): SaltHash {
        return this.saltAndHash(password);
    }
    
}