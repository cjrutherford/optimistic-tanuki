import * as net from 'net';
import { Pool } from 'pg';
import { AuthCommands } from '@optimistic-tanuki/constants'; // For message patterns
import { RegisterRequest, LoginRequest } from '@optimistic-tanuki/models';

// Helper to generate unique email for testing
const generateUniqueEmail = (prefix = 'tcpuser_') => `${prefix}${Date.now()}@example.com`;

// Promisified TCP request sender
function sendTcpRequest(port: number, host: string, messagePayload: any, timeoutMs = 7000): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let completeData = '';
    const requestId = messagePayload.id || Date.now() + Math.random(); // Use provided ID or generate one

    // Ensure the payload being sent to the server includes the ID for tracking.
    // The pattern should be part of the messagePayload as per NestJS convention for microservices.
    const messageToSend = JSON.stringify({ ...messagePayload, id: requestId });

    client.connect(port, host, () => {
      client.write(messageToSend + '\n'); // Assuming newline delimiter, NestJS default might differ (length-prefixing)
    });

    const timer = setTimeout(() => {
      client.destroy();
      reject(new Error(`TCP request timed out after ${timeoutMs}ms. Partial data: ${completeData}`));
    }, timeoutMs);

    client.on('data', (data) => {
      completeData += data.toString();
      // Try to parse if we have a potential end of a JSON object.
      // This is a simplified parser; NestJS's default TCP strategy uses length prefixing
      // which would make framing more reliable.
      try {
        // Assume the response is a single JSON object per request for these tests.
        // This might accumulate if multiple JSON objects are sent without proper framing detection.
        const parsedResponse = JSON.parse(completeData);
        // Check if the response has the same ID as the request
        if (parsedResponse.id === requestId) {
          clearTimeout(timer);
          client.end(); // Close connection once we have a response for our ID.
          if (parsedResponse.err) {
            reject(new Error(JSON.stringify(parsedResponse.err)));
          } else {
            resolve(parsedResponse.response !== undefined ? parsedResponse.response : parsedResponse);
          }
        }
      } catch (e) {
        // Not a complete JSON object yet, or malformed. Wait for more data or timeout.
      }
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      client.destroy();
      reject(err);
    });

    client.on('close', (hadError) => {
      clearTimeout(timer);
      // If connection closed and we haven't resolved, try one last parse or reject.
      try {
        const parsedResponse = JSON.parse(completeData);
        if (parsedResponse.id === requestId) {
          if (parsedResponse.err) reject(new Error(JSON.stringify(parsedResponse.err)));
          else resolve(parsedResponse.response !== undefined ? parsedResponse.response : parsedResponse);
          return;
        }
      } catch(e) {
        // Ignore parsing error if already rejected by timeout or other error
      }
      if (!client.destroyed || !hadError) { // Avoid rejecting if already handled by error event or timeout
         // If no specific response for our ID was processed before close.
        reject(new Error('Connection closed without a specific response for the sent ID. Data: ' + completeData));
      }
    });
  });
}


describe('Authentication Service TCP Tests', () => {
  let pgPool: Pool;
  const testHost = '127.0.0.1'; // All containers are on localhost from host perspective
  let mappedAuthPort: number;

  const userEmail = generateUniqueEmail();
  const userPassword = 'securePassword123';
  const userFirstName = 'TCP';
  const userLastName = 'Tester';

  beforeAll(async () => {
    if (!globalThis.postgresContainer) {
      throw new Error('PostgreSQL container is not available.');
    }
    if (!globalThis.mappedAuthenticationTcpPort) {
      throw new Error('Authentication service mapped TCP port is not available.');
    }
    mappedAuthPort = globalThis.mappedAuthenticationTcpPort;

    pgPool = new Pool({
      host: globalThis.postgresContainer.getHost(),
      port: globalThis.postgresContainer.getMappedPort(5432),
      user: globalThis.postgresContainer.getUsername(),
      password: globalThis.postgresContainer.getPassword(),
      database: 'ot_test_authentication', // Connect directly to the auth DB
    });
    await pgPool.connect();
    console.log('pg.Pool connected to ot_test_authentication for TCP tests.');
  });

  afterAll(async () => {
    if (pgPool) {
      await pgPool.end();
      console.log('pg.Pool connection closed for TCP tests.');
    }
  });

  describe('User Registration (AuthCommands.Register)', () => {
    it('should reject registration with invalid/missing data', async () => {
      const payload = {
        pattern: { cmd: AuthCommands.Register },
        data: { email: 'invalid-email' }, // Missing other required fields like fn, ln, password, confirm
      };
      try {
        await sendTcpRequest(mappedAuthPort, testHost, payload);
        fail('Request should have failed due to missing fields.');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // Error message from RpcException in controller: "Missing required fields: fn ln password confirm"
        expect(error.message).toContain('Missing required fields');
      }
    });

    it('should successfully register a new user', async () => {
      const registrationData: RegisterRequest = {
        email: userEmail,
        fn: userFirstName,
        ln: userLastName,
        password: userPassword,
        confirm: userPassword,
        bio: 'Test bio for TCP user',
      };
      const payload = {
        pattern: { cmd: AuthCommands.Register },
        data: registrationData,
      };

      const response = await sendTcpRequest(mappedAuthPort, testHost, payload);
      expect(response).toBeDefined();
      expect(response.id).toBeDefined(); // UserEntity should have an id
      expect(response.email).toBe(userEmail);

      // DB Verification
      const userInDb = await pgPool.query('SELECT * FROM "user_entity" WHERE "email" = $1', [userEmail]);
      expect(userInDb.rows.length).toBe(1);
      expect(userInDb.rows[0].email).toBe(userEmail);
      expect(userInDb.rows[0].firstName).toBe(userFirstName); // fn maps to firstName
      expect(userInDb.rows[0].lastName).toBe(userLastName);  // ln maps to lastName
    });
  });

  describe('User Login (AuthCommands.Login)', () => {
    it('should reject login for a non-existent user', async () => {
      const loginData: LoginRequest = { email: 'nouser@example.com', password: 'password' };
      const payload = {
        pattern: { cmd: AuthCommands.Login },
        data: loginData,
      };
      try {
        await sendTcpRequest(mappedAuthPort, testHost, payload);
        fail('Request should have failed for non-existent user.');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // Specific error message depends on appService implementation
        expect(error.message).toBeTruthy();
      }
    });

    it('should reject login with an incorrect password', async () => {
      const loginData: LoginRequest = { email: userEmail, password: 'wrongpassword' };
      const payload = {
        pattern: { cmd: AuthCommands.Login },
        data: loginData,
      };
      try {
        await sendTcpRequest(mappedAuthPort, testHost, payload);
        fail('Request should have failed due to incorrect password.');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
         // Specific error message depends on appService implementation
        expect(error.message).toBeTruthy();
      }
    });

    it('should successfully log in the registered user', async () => {
      const loginData: LoginRequest = { email: userEmail, password: userPassword };
      const payload = {
        pattern: { cmd: AuthCommands.Login },
        data: loginData,
      };

      const response = await sendTcpRequest(mappedAuthPort, testHost, payload);
      expect(response).toBeDefined();
      expect(response.accessToken).toBeDefined();
      expect(response.accessToken).toBeTruthy();
      expect(response.user).toBeDefined();
      expect(response.user.email).toBe(userEmail);
    });
  });
});
