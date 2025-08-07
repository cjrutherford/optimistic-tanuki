/**
 * Interface for a login request.
 */
export default interface LoginRequest {
    /**
     * The user's email address.
     */
    email: string;
    /**
     * The user's password.
     */
    password: string;
}