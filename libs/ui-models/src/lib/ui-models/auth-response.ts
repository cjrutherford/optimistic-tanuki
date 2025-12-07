export interface AuthResponse {
  message: string;
  code: number;
  data: {
    newToken: string;
  };
}
