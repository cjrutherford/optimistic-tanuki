import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty } from 'class-validator';

export class ValidateTokenRequest {
    @IsString()
    @IsNotEmpty()
    @ApiProperty()
    userId!: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty()
    token!: string;
}