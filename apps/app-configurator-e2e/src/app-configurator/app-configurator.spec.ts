import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { AppConfigCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

/**
 * The app-configurator TCP contract as it stands after the ownership work.
 *
 * Owner reads — GetAll, GetByName, Get, GetByContext — now require a complete
 * app configuration context (owner, workspace, app instance and membership)
 * and refuse without one. The previous version of this suite called GetAll
 * with `{}` and GetByName with just a name, and expected a seeded `demo-app`
 * that nothing in this stack creates; both cases failed with "A complete app
 * configuration context is required". Proving an owner read properly needs
 * persisted workspace and membership rows, which gateway-e2e's P3.3 fixture
 * already builds end to end, so this suite covers what a bare microservice
 * stack can honestly assert: owner reads are closed without context, and the
 * public surfaces answer without one.
 */
describe('AppConfigurator Microservice (TCP)', () => {
  let client: ClientProxy;

  beforeAll(async () => {
    const host = process.env.HOST ?? 'localhost';
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3014;

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host, port },
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
  });

  it('refuses to list configurations without an owner context', async () => {
    await expect(
      firstValueFrom(client.send({ cmd: AppConfigCommands.GetAll }, {}))
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        'A complete app configuration context is required'
      ),
    });
  });

  it('refuses a by-name read without an owner context', async () => {
    await expect(
      firstValueFrom(
        client.send({ cmd: AppConfigCommands.GetByName }, { name: 'demo-app' })
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        'A complete app configuration context is required'
      ),
    });
  });

  it('answers anonymous discovery with a list', async () => {
    const apps = await firstValueFrom(
      client.send(
        { cmd: AppConfigCommands.DiscoverPublishedApps },
        { identity: null, query: {} }
      )
    );

    expect(Array.isArray(apps)).toBe(true);
  });

  it('does not expose an unpublished domain', async () => {
    await expect(
      firstValueFrom(
        client.send(
          { cmd: AppConfigCommands.GetPublishedByDomain },
          { domain: 'nothing-published-here.example.test' }
        )
      )
    ).rejects.toBeDefined();
  });
});
