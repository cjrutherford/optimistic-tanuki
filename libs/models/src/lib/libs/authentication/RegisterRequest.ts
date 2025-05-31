import { ApiProperty } from '@nestjs/swagger';
export default class RegisterRequest {
    @ApiProperty({
        description: 'First Name of the user.',
    })
    fn: string;

    @ApiProperty({
        description: 'Last Name of the user.',
    })
    ln: string;

    @ApiProperty({
        description: 'Email of the user.',
    })
    email: string;

    @ApiProperty({
        description: 'Password of the user.',
    })
    password: string;

    @ApiProperty({
        description: 'password confirmation for the user.',
    })
    confirm: string;

    @ApiProperty({
        description: 'user biography',
    })
    bio: string;

}