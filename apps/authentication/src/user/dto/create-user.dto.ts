/**
 * Data transfer object for creating a new user.
 */
export class CreateUserDto {
    /**
     * The first name of the user.
     */
    firstName = '';
    /**
     * The last name of the user.
     */
    lastName = '';
    /**
     * The email address of the user.
     */
    email = '';
    /**
     * The password for the user.
     */
    password = '';
    /**
     * The biography of the user.
     */
    bio = '';
    /**
     * The confirmation password for the user.
     */
    confirmPassword = '';
}

