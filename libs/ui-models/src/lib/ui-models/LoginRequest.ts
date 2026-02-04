export default interface LoginRequest {
  email: string;
  password: string;
  mfa?: string;
}

export interface LoginResponse {
  data: {
    newToken: string;
  };
}
