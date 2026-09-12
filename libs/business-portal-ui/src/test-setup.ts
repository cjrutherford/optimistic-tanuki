import 'jest-preset-angular/setup-jest';
import { deserialize, serialize } from 'node:v8';

if (typeof globalThis.structuredClone !== 'function') {
  Object.defineProperty(globalThis, 'structuredClone', {
    configurable: true,
    value: <T>(value: T): T => deserialize(serialize(value)) as T,
  });
}
