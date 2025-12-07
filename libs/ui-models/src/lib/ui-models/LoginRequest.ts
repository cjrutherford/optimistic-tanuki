export default interface LoginRequest {
    email: string;
    password: string;
    mfa?: string;
}