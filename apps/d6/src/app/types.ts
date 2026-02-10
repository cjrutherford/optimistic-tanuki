import { InjectionToken } from '@angular/core';

export interface LoginRequest {
  login: string;
  password: string;
  loginType?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword?: string;
  registerType?: string;
}

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
