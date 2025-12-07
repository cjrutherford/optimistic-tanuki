import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

describe('Authentication Microservice E2E', () => {
  let authClient: ClientProxy;
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    fn: 'Test',
    ln: 'User',
    password: 'Test@Password123',
    confirm: 'Test@Password123',
    bio: 'Test user bio',
  };
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Create a client proxy to connect to the authentication microservice
    authClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: globalThis.socketConnectionOptions?.host || '127.0.0.1',
        port: globalThis.socketConnectionOptions?.port || 3001,
      },
    });

    // Connect to the microservice
    await authClient.connect();
  });

  afterAll(async () => {
    // Close the connection
    await authClient.close();
  });

  describe('Register', () => {
    it('should register a new user', async () => {
      const result = await firstValueFrom(
        authClient.send({ cmd: AuthCommands.Register }, testUser)
      );

      expect(result).toBeDefined();
      expect(result.data.user).toBeDefined();
      expect(result.data.user.email).toBe(testUser.email);
      expect(result.data.user.firstName).toBe(testUser.fn);
      expect(result.data.user.lastName).toBe(testUser.ln);

      userId = result.data.user.id;
    });

    it('should fail to register with missing fields', async () => {
      try {
        await firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.Register },
            {
              email: 'incomplete@example.com',
            }
          )
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should fail to register with mismatched passwords', async () => {
      try {
        await firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.Register },
            {
              email: `mismatch-${Date.now()}@example.com`,
              fn: 'Test',
              ln: 'User',
              password: 'Password123!',
              confirm: 'DifferentPassword123!',
            }
          )
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should fail to register with duplicate email', async () => {
      try {
        await firstValueFrom(
          authClient.send({ cmd: AuthCommands.Register }, testUser)
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Login', () => {
    it('should login with valid credentials', async () => {
      const result = await firstValueFrom(
        authClient.send(
          { cmd: AuthCommands.Login },
          {
            email: testUser.email,
            password: testUser.password,
          }
        )
      );

      expect(result).toBeDefined();
      expect(result.data.newToken).toBeDefined();

      authToken = result.data.newToken;
    });

    it('should fail to login with invalid email', async () => {
      try {
        await firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.Login },
            {
              email: 'nonexistent@example.com',
              password: testUser.password,
            }
          )
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should fail to login with invalid password', async () => {
      try {
        await firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.Login },
            {
              email: testUser.email,
              password: 'WrongPassword123!',
            }
          )
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should fail to login with missing fields', async () => {
      try {
        await firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.Login },
            {
              email: testUser.email,
            }
          )
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Validate Token', () => {
    it('should validate a valid token', async () => {
      const result = await firstValueFrom(
        authClient.send(
          { cmd: AuthCommands.Validate },
          {
            token: authToken,
            userId: userId,
          }
        )
      );

      expect(result).toBeDefined();
      expect(result.code).toBe(0);
      expect(result.data).toBeDefined();
      expect(result.data.email).toBe(testUser.email);
    });

    it('should fail to validate an invalid token', async () => {
      try {
        await firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.Validate },
            {
              token: 'invalid-token-12345',
              userId: userId,
            }
          )
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should fail to validate with missing fields', async () => {
      try {
        await firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.Validate },
            {
              token: authToken,
            }
          )
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Reset Password', () => {
    it('should reset password with valid credentials', async () => {
      const newPassword = 'NewPassword123!';
      const result = await firstValueFrom(
        authClient.send(
          { cmd: AuthCommands.ResetPassword },
          {
            email: testUser.email,
            oldPass: testUser.password,
            newPass: newPassword,
            newConf: newPassword,
          }
        )
      );

      expect(result).toBeDefined();
      expect(result.code).toBe(0);

      // Update the test user's password for any subsequent tests
      testUser.password = newPassword;
      testUser.confirm = newPassword;
    });

    it('should fail to reset password with wrong old password', async () => {
      try {
        await firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.ResetPassword },
            {
              email: testUser.email,
              oldPass: 'WrongOldPassword123!',
              newPass: 'NewPassword456!',
              newConf: 'NewPassword456!',
            }
          )
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should fail to reset password with mismatched new passwords', async () => {
      try {
        await firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.ResetPassword },
            {
              email: testUser.email,
              oldPass: testUser.password,
              newPass: 'NewPassword123!',
              newConf: 'DifferentPassword123!',
            }
          )
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should fail to reset password with missing fields', async () => {
      try {
        await firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.ResetPassword },
            {
              email: testUser.email,
              oldPass: testUser.password,
            }
          )
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
