import { dropCreatedSchemas } from './postgres.js';

afterAll(async () => {
  await dropCreatedSchemas();
});
