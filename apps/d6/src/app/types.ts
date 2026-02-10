import { InjectionToken } from '@angular/core';
import type {
  LoginRequest,
  RegisterRequest,
} from '@optimistic-tanuki/ui-models';

export { LoginRequest, RegisterRequest };

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
