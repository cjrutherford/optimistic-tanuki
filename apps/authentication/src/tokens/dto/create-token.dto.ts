
/**
 * Data transfer object for creating a new token.
 */
export class CreateTokenDto {
    /**
     * The email associated with the token.
     */
    email: string;
    /**
     * The biography associated with the token.
     */
    bio: string;
    /**
     * The session key for the token.
     */
    session_key: string;
}
