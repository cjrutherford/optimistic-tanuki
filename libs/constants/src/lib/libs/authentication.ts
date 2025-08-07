
/**
 * Defines commands related to authentication operations.
 */
const AuthCommands = {
    /**
     * Command for user login.
     */
    Login: 'Login',
    /**
     * Command to enable multi-factor authentication.
     */
    EnableMultiFactor: 'EnableMultiFactor',
    /**
     * Command to reset user password.
     */
    ResetPassword: 'ResetPassword',
    /**
     * Command for user registration.
     */
    Register: 'Register',
    /**
     * Command to validate an authentication token.
     */
    Validate: 'Validate',
    /**
     * Command to validate a TOTP token.
     */
    ValidateTotp: 'ValidateTotp'
};

export default AuthCommands;