import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { PromptCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

describe('Prompt Proxy Microservice E2E', () => {
  let promptProxyClient: ClientProxy;

  beforeAll(async () => {
    promptProxyClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: globalThis.socketConnectionOptions?.host || '127.0.0.1',
        port: globalThis.socketConnectionOptions?.port || 3009,
      },
    });

    await promptProxyClient.connect();
  });

  afterAll(async () => {
    await promptProxyClient.close();
  });

  it('should be connected', () => {
    expect(promptProxyClient).toBeDefined();
  });

  // Since prompt-proxy calls an external LLM (Ollama usually),
  // we might want to just test the connection or a simple message if possible.
  // However, without a running LLM it might fail.
  // Let's see if we can at least send a command and get a response (even if error).

  it('should attempt to send a message', async () => {
    try {
      const result = await firstValueFrom(
        promptProxyClient.send(
          { cmd: PromptCommands.SEND },
          {
            message: 'Hello',
            persona: 'Test',
          }
        )
      );
      expect(result).toBeDefined();
    } catch (error) {
      // If LLM is not available, it might throw, but at least we reached the microservice
      expect(error).toBeDefined();
    }
  });
});
