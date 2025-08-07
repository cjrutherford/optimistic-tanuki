import { Inject, Injectable, Logger } from '@nestjs/common';
import { getRepositoryToken, InjectRepository } from '@nestjs/typeorm';
import { timingSafeEqual } from 'crypto';
import { UserEntity } from '../user/entities/user.entity';
import { Repository } from 'typeorm';
import validator from 'validator';
import { SaltedHashService } from '@optimistic-tanuki/encryption';
import { RpcException } from '@nestjs/microservices';
import * as jwt from 'jsonwebtoken';
import * as qrcode from 'qrcode';
import { TokenEntity } from '../tokens/entities/token.entity';
import { KeyService } from './key.service';
import { KeyDatum } from '../key-data/entities/key-datum.entity';
import { Repositories } from '../constants';
import { randomBytes } from 'crypto';
import { authenticator } from 'otplib';

/**
 * Service for handling authentication-related operations.
 */
@Injectable()
export class AppService {
  /**
   * Creates an instance of AppService.
   * @param l The logger instance.
   * @param userRepo The repository for UserEntity.
   * @param tokenRepo The repository for TokenEntity.
   * @param keyRepo The repository for KeyDatum.
   * @param saltedHashService The service for salted hashing.
   * @param keyService The service for key management.
   * @param jwtSecret The JWT secret.
   * @param totp The TOTP authenticator instance.
   * @param jsonWebToken The JWT instance.
   */
  constructor(
    private readonly l: Logger,
    @Inject(getRepositoryToken(UserEntity))
    private readonly userRepo: Repository<UserEntity>,
    @Inject(getRepositoryToken(TokenEntity))
    private readonly tokenRepo: Repository<TokenEntity>,
    @Inject(getRepositoryToken(KeyDatum))
    private readonly keyRepo: Repository<KeyDatum>,
    private readonly saltedHashService: SaltedHashService,
    private readonly keyService: KeyService,
    @Inject('JWT_SECRET') private readonly jwtSecret: string,
    @Inject('totp') private readonly totp: typeof authenticator,
    @Inject('jwt') private readonly jsonWebToken: typeof jwt
  ) {}

  /**
   * Handles user login.
   * @param email The user's email.
   * @param password The user's password.
   * @param mfa Optional MFA token.
   * @returns An object containing a message, code, and new token.
   * @throws RpcException if login fails.
   */
  async login(email: string, password: string, mfa?: string) {
    try {
      const user = await this.userRepo.findOne({
        where: { email },
        relations: ['keyData'],
      });
      if (!user) {
        throw new RpcException('User not found');
      }

      const {
        id: userId,
        password: storedHash,
        totpSecret,
      } = user;

      const valid = await this.saltedHashService.validateHash(
        password,
        storedHash,
        user.keyData?.salt,
      );

      if (!valid) {
        throw new RpcException('Invalid password');
      }

      if (mfa !== undefined) {
        const isValidMfa = this.totp.check(mfa, user.totpSecret);
        if (!isValidMfa) {
          throw new RpcException('Invalid MFA token');
        }
      } else if (user.totpSecret !== null && mfa === undefined) {
        throw new RpcException('MFA token is required for this user.');
      }

      const pl = { userId, name: `${user.firstName} ${user.lastName}`, email };
      const tk = this.jsonWebToken.sign(pl, this.jwtSecret, {
        expiresIn: '1h',
      });

      delete user.keyData;
      delete user.password;
      const ntk = {
        tokenData: tk,
        userId,
        user,
        revoked: false,
      };
      await this.tokenRepo.save(ntk);

      return { message: 'Login successful', code: 0, data: { newToken: tk } };
    } catch (e) {
      console.error('Error in login:', e);
      if (e instanceof RpcException) {
        throw e;
      }
      throw new RpcException(e.message);
    }
  }

  /**
   * Registers a new user.
   * @param email The user's email.
   * @param fn The user's first name.
   * @param ln The user's last name.
   * @param password The user's password.
   * @param confirm The password confirmation.
   * @param bio Optional user biography.
   * @returns An object containing a message, code, and user data.
   * @throws RpcException if registration fails.
   */
  async registerUser(
    email: string,
    fn: string,
    ln: string,
    password: string,
    confirm: string,
    bio = ''
  ) {
    try {
      if (typeof password !== 'string' || typeof confirm !== 'string') {
        throw new RpcException('Invalid data');
      }
      this.l.log('Registering user:', email, fn, ln, bio);
      this.l.log('Checking passwords', password, confirm);
      const weakPasswordRegex =
      // eslint-disable-next-line no-useless-escape
        /^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
      if (!weakPasswordRegex.test(password)) {
        throw new RpcException('Password is too weak');
      }
      const passwordBuffer = Buffer.from(password);
      const confirmBuffer = Buffer.from(confirm);
      if (
        !timingSafeEqual(
          new Uint8Array(passwordBuffer.buffer, passwordBuffer.byteOffset, passwordBuffer.byteLength),
          new Uint8Array(confirmBuffer.buffer, confirmBuffer.byteOffset, confirmBuffer.byteLength)
        )
      ) {
        throw new RpcException('Passwords do not match');
      }
      this.l.log('Passwords match, proceeding with registration');
      if (typeof email !== 'string' || !validator.isEmail(email)) {
        this.l.error(`Invalid Email: ${email}`);
        throw new RpcException('Invalid Email ' + email);
      }
      if(!fn) {
        this.l.error('First name is required');
        throw new RpcException('First Name is required');
      }
      if(!ln) {
        this.l.error('Last name is required');
        throw new RpcException('Last Name is required');
      }
      this.l.log('Email is valid, checking for existing user');
      const existingUser = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
      this.l.log('Existing user check complete:', existingUser);
      if (existingUser) {
        console.error('User already exists');
        throw new RpcException('User already exists');
      }
      this.l.log('Creating new user hash');
      const hashData = await this.saltedHashService.createNewHash(password);
      if (!hashData) {
        console.error('Error creating hash');
        throw new RpcException('Error creating hash');
      }
      this.l.log('Hash created successfully:', hashData);
      const insertResult = await this.userRepo.insert({
        email,
        firstName: fn,
        lastName: ln,
        password: hashData.hash,
        keyData: { salt: hashData.salt },
        bio: bio,
      });
      this.l.log('User inserted successfully:', insertResult);
      const newUserId = insertResult.identifiers[0].id;
      const newUser = await this.userRepo.findOne({ where: { id: newUserId } }); // njsscan-ignore: node_nosqli_injection

      if (!newUser) {
        console.error('Error retrieving new user after insert');
        throw new RpcException('Error retrieving new user');
      }
      const { pubKey, privLocation } = await this.keyService.generateUserKeys(
        newUser.id,
        hashData.hash
      );
      this.l.log('User keys generated successfully:', pubKey, privLocation);
      const nk: Partial<KeyDatum> = {
        public: Buffer.from(pubKey),
        salt: hashData.salt.toString(),
      };

      this.l.log(`Saving new key data for user: ${newUser.id}`);
      const newKeyData = await this.keyRepo.save({ ...nk });
      newUser.keyData = newKeyData;
      await this.userRepo.save(newUser);

      this.l.log('New user registered successfully:', newUser);
      return {
        message: 'User Created',
        code: 0,
        data: {
          pub: pubKey,
          user: newUser.id,
          privKey: privLocation,
          inventory: undefined,
        },
      };
    } catch (e) {
      console.trace(e);
      console.error('Error in registerUser:', e);
      throw new RpcException(e);
    }
  }

  /**
   * Resets a user's password.
   * @param email The user's email.
   * @param newPassword The new password.
   * @param confirm The new password confirmation.
   * @param oldPass The old password.
   * @param mfa Optional MFA token.
   * @returns An object indicating password reset success.
   * @throws RpcException if password reset fails.
   */
  async resetPassword(
    email: string,
    newPassword: string,
    confirm: string,
    oldPass: string,
    mfa?: string
  ) {
    // Implement your password reset logic here
    const weakPasswordRegex =
    // eslint-disable-next-line no-useless-escape
      /^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
    if (!weakPasswordRegex.test(newPassword)) {
      throw new RpcException('Password is too weak');
    }
    if (newPassword !== confirm) {
      throw new RpcException('Passwords do not match');
    }

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user || !user.keyData) {
      throw new RpcException('User not found');
    }

    const valid = await this.saltedHashService.validateHash(
      oldPass,
      user.password,
      user.keyData.salt
    );

    if (!valid) {
      throw new RpcException('Invalid old password');
    }

    if (mfa !== undefined) {
      const isValidMfa = this.totp.check(mfa, user.totpSecret);
      if (!isValidMfa) {
        throw new RpcException('Invalid MFA token');
      }
    } else if (user.totpSecret !== null && mfa === undefined) {
      throw new RpcException('MFA token is required for this user.');
    }

    const { salt, hash } = this.saltedHashService.createNewHash(newPassword);
    user.password = hash;
    user.keyData.salt = salt;
    await this.userRepo.save(user);
    return { message: 'Password reset successful', code: 0 };
  }

  /**
   * Validates a given JWT token.
   * @param token The JWT token to validate.
   * @returns An object indicating token validity and decoded data.
   * @throws RpcException if the token is invalid or revoked.
   */
  async validateToken(token: string) {
    try {
      const decoded = this.jsonWebToken.verify(token, this.jwtSecret);
      const storedToken = await this.tokenRepo.findOne({
        where: { tokenData: token },
      });
      if (!storedToken || storedToken.revoked) {
        throw new RpcException('Token is invalid or revoked');
      }
      return {
        message: 'Token is valid',
        code: 0,
        data: decoded,
        isValid: true,
      };
    } catch (e) {
      throw new RpcException('Invalid token');
    }
  }

  /**
   * Sets up TOTP for a user.
   * @param userId The ID of the user.
   * @returns An object containing a message, code, and QR code data.
   * @throws RpcException if TOTP setup fails.
   */
  async setupTotp(userId: string) {
    // Implement your TOTP setup logic here
    const newSecret = randomBytes(20).toString('hex');
    try {
      const existingUser = await this.userRepo.findOne({
        where: { id: userId },
      });
      if (!existingUser) throw new RpcException('User not found');
      if (existingUser.totpSecret)
        throw new RpcException('TOTP already set up');
      await this.userRepo.update(userId, { totpSecret: newSecret });
      return {
        message: 'TOTP setup successful',
        code: 0,
        data: {
          qr: qrcode.toDataURL(
            authenticator.keyuri(userId, 'optomistic-tanuki', newSecret)
          ),
        },
      };
    } catch (e) {
      console.error('Error setting up TOTP:', e);
      throw new RpcException(`TOTP setup failed: ${e.message}`);
    }
  }

  /**
   * Validates a TOTP token for a user.
   * @param userId The ID of the user.
   * @param token The TOTP token to validate.
   * @returns An object indicating TOTP token validity.
   * @throws RpcException if TOTP validation fails.
   */
  async validateTotp(userId: string, token: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw new RpcException('User not found or TOTP not set up');
    }
    const isValid = this.totp.check(token, user.totpSecret);
    if (!isValid) {
      throw new RpcException('Invalid TOTP token');
    }
    return { message: 'TOTP token is valid', code: 0 };
  }
}
