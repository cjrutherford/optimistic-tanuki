import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ description: 'First name of the user', example: 'John' })
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    firstName = '';

    @ApiProperty({ description: 'Last name of the user', example: 'Doe' })
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    lastName = '';

    @ApiProperty({ description: 'Email address', example: 'john.doe@example.com' })
    @IsEmail()
    @MaxLength(255)
    email = '';

    @ApiProperty({ description: 'Password (min 8 characters, must contain uppercase, lowercase, number, and special character)' })
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        { message: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character' }
    )
    password = '';

    @ApiProperty({ description: 'Bio of the user', required: false })
    @IsString()
    @MaxLength(2000)
    bio = '';

    @ApiProperty({ description: 'Confirm password (must match password)' })
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    confirmPassword = '';
}

