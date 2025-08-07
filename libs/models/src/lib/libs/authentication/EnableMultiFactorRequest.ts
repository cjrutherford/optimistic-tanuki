/**
 * Represents a request to enable multi-factor authentication.
 */
export default class EnableMultiFactorRequest {
    /**
     * The ID of the user for whom to enable MFA.
     */
    userId = '';
    /**
     * The user's password.
     */
    password = '';
    /**
     * The initial TOTP token for verification.
     */
    initialTotp = '';
  }