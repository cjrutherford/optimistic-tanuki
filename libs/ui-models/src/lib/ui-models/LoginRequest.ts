export default interface LoginRequest {
  email: string;
  password: string;
  mfa?: string;
  dateOfBirth?: string;
  guardianEmail?: string;
}

export interface LoginResponse {
  data: {
    newToken: string;
  };
}
