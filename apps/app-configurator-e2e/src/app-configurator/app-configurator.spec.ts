import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { AppConfigCommands } from '../../../app-configurator/src/configurations/configurations.controller';

describe('AppConfigurator Microservice (TCP)', () => {
  let client: ClientProxy;

  beforeAll(async () => {
    const host = process.env.HOST ?? 'localhost';
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3014;

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host,
        port,
      },
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
  });

  it('should get all configurations', async () => {
    const res = await client.send({ cmd: AppConfigCommands.GetAll }, {}).toPromise();

    expect(Array.isArray(res)).toBe(true);
    // There should be at least the demo config we seeded
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0]).toHaveProperty('name');
  });

  it('should get a configuration by name (demo)', async () => {
    const res = await client.send({ cmd: AppConfigCommands.GetByName }, { name: 'demo-app' }).toPromise();

    expect(res).toBeDefined();
    expect(res.name).toBe('demo-app');
  });
});