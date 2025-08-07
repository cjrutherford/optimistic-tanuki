import { ApiProperty } from '@nestjs/swagger';
/**
 * Represents a user registration request.
 */
export default class RegisterRequest {
    /**
     * The first name of the user.
     */
    @ApiProperty({
        description: 'First Name of the user.',
    })
    fn!: string;

    /**
     * The last name of the user.
     */
    @ApiProperty({
        description: 'Last Name of the user.',
    })
    ln!: string;

    /**
     * The email address of the user.
     */
    @ApiProperty({
        description: 'Email of the user.',
    })
    email!: string;

    /**
     * The password for the user.
     */
    @ApiProperty({
        description: 'Password of the user.',
    })
    password!: string;

    /**
     * The password confirmation for the user.
     */
    @ApiProperty({
        description: 'password confirmation for the user.',
    })
    confirm!: string;

    /**
     * The user's biography.
     */
    @ApiProperty({
        description: 'user biography',
    })
    bio!: string;

}