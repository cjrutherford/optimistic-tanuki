const { ClientProxyFactory, Transport } = require('@nestjs/microservices');
const { firstValueFrom } = require('rxjs');

async function bootstrap() {
  const host = process.argv[2] || 'localhost';
  const port = parseInt(process.argv[3] || '3000', 10);

  console.log(`Connecting to ${host}:${port}...`);

  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: host,
      port: port,
    },
  });

  try {
    await client.connect();
    console.log('Connected. Sending health-check command...');

    // Send the message. The pattern must match what's in the controller.
    // In controller: @MessagePattern({ cmd: 'health-check' })
    // So pattern is { cmd: 'health-check' }
    const result = await firstValueFrom(
      client.send({ cmd: 'health-check' }, {})
    );

    console.log('Received response:', result);

    if (result && result.status === 'healthy') {
      console.log('Health check passed');
      process.exit(0);
    } else {
      console.error('Health check failed: Invalid response', result);
      process.exit(1);
    }
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

bootstrap();
