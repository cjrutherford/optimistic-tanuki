import { registerAs } from '@nestjs/config';

export default registerAs('hardware', () => ({
  listenPort: process.env.HARDWARE_SERVICE_PORT || 3021,
}));
