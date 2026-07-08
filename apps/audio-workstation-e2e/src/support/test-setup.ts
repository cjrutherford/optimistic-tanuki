import { ClientProxyFactory, Transport } from '@nestjs/microservices';

module.exports = async function () {
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.AUDIO_WORKSTATION_PORT ?? '3025';

  // Create a TCP client for the audio workstation
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host, port: parseInt(port, 10) },
  });

  await client.connect();
  (globalThis as any).__audioWorkstationClient = client;
};
