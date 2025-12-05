import { Inject, Injectable, Logger } from '@nestjs/common';
import { getRepositoryToken, InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
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

@Injectable()
export class AppService {
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
    private readonly jsonWebToken: JwtService
  ) {}

  async getUserIdFromEmail(email: string): Promise<string> {
    try {
      const user = await this.userRepo.findOne({ where: { email } });
      if (!user) {
        throw new RpcException('User not found');
      }
      this.l.debug(`Found user ID ${user.id} for email ${email}`);
      return user.id;
    } catch (e) {
      if (e instanceof RpcException) {
        throw e;
      }
      throw new RpcException(e);
    }
  }

  async login(
    email: string,
    password: string,
    mfa?: string,
    profileId?: string
  ) {
    try {
      const user = await this.userRepo.findOne({
        where: { email },
        relations: ['keyData'],
      });
      if (!user) {
        throw new RpcException('User not found');
      }

      const { id: userId, password: storedHash, totpSecret } = user;

      const valid = await this.saltedHashService.validateHash(
        password,
        storedHash,
        user.keyData?.salt
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
      // Include profileId in token if provided, otherwise empty string
      // The profileId should be determined by the client based on appScope
      (pl as any).profileId = profileId || '';
      const tk = this.jsonWebToken.sign(pl, {
        secret: this.jwtSecret,
        expiresIn: '1h',
      });

      delete user.keyData;
      delete user.password;
      const ntk = {
        tokenData: tk,
        userId,
        user,
        revoked: false,
        profileId: profileId || null,
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
        /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
      if (!weakPasswordRegex.test(password)) {
        throw new RpcException('Password is too weak');
      }
      const passwordBuffer = Buffer.from(password);
      const confirmBuffer = Buffer.from(confirm);
      if (
        !timingSafeEqual(
          new Uint8Array(
            passwordBuffer.buffer,
            passwordBuffer.byteOffset,
            passwordBuffer.byteLength
          ),
          new Uint8Array(
            confirmBuffer.buffer,
            confirmBuffer.byteOffset,
            confirmBuffer.byteLength
          )
        )
      ) {
        throw new RpcException('Passwords do not match');
      }
      this.l.log('Passwords match, proceeding with registration');
      if (typeof email !== 'string' || !validator.isEmail(email)) {
        this.l.error(`Invalid Email: ${email}`);
        throw new RpcException('Invalid Email ' + email);
      }
      if (!fn) {
        this.l.error('First name is required');
        throw new RpcException('First Name is required');
      }
      if (!ln) {
        this.l.error('Last name is required');
        throw new RpcException('Last Name is required');
      }
      this.l.log('Email is valid, checking for existing user');
      const existingUser = await this.userRepo.findOne({
        where: { email: email.toLowerCase() },
      });
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
          user: newUser,
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
      /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
    if (!weakPasswordRegex.test(newPassword)) {
      throw new RpcException('Password is too weak');
    }
    if (newPassword !== confirm) {
      throw new RpcException('Passwords do not match');
    }

    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['keyData'],
    });
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

  async validateToken(token: string) {
    try {
      const valid = await this.jsonWebToken.verifyAsync(token, {
        secret: this.jwtSecret,
      });
      if (!valid) {
        throw new RpcException('Invalid token');
      }
      const storedToken = await this.tokenRepo.findOne({
        where: { tokenData: token },
      });
      if (!storedToken || storedToken.revoked) {
        throw new RpcException('Token is invalid or revoked');
      }
      return {
        message: 'Token is valid',
        code: 0,
        data: valid,
        isValid: true,
      };
    } catch (e) {
      throw new RpcException('Invalid token');
    }
  }

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

  async issueToken(userId: string, profileId?: string) {
    try {
      this.l.debug(
        `Issuing token for userId: ${userId}, profileId: ${profileId}`
      );
      const user = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['keyData'],
      });
      if (!user) throw new RpcException('User not found');

      const pl = {
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        profileId: profileId ?? '',
      };

      const tk = this.jsonWebToken.sign(pl, {
        expiresIn: '1h',
        secret: this.jwtSecret,
      });

      // Save token
      const ntk = {
        tokenData: tk,
        userId: user.id,
        user,
        revoked: false,
      };
      await this.tokenRepo.save(ntk);

      // remove sensitive fields before returning user
      delete user.keyData;
      delete user.password;

      return { message: 'Issued token', code: 0, data: { newToken: tk } };
    } catch (e) {
      console.error('Error issuing token:', e);
      if (e instanceof RpcException) throw e;
      throw new RpcException(e.message || e);
    }
  }
}
