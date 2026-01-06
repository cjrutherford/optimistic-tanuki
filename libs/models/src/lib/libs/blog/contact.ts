// filepath: /home/cjrutherford/workspace/optimistic-tanuki/libs/models/src/lib/libs/blog/contact.ts
import { DateRange } from '../util/date-range';
import { IsString, IsEmail, IsOptional, MaxLength, MinLength, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ContactDto {
    @ApiProperty({ description: 'Contact ID' })
    id: string;
    
    @ApiProperty({ description: 'Contact name' })
    name: string;
    
    @ApiProperty({ description: 'Contact message' })
    message: string;
    
    @ApiProperty({ description: 'Contact email' })
    email: string;
    
    @ApiProperty({ description: 'Contact phone', required: false })
    phone?: string;
    
    @ApiProperty({ description: 'Created timestamp' })
    createdAt: Date;
    
    @ApiProperty({ description: 'Updated timestamp' })
    updatedAt: Date;
}

export class CreateContactDto {
    @ApiProperty({ description: 'Contact name', example: 'John Doe' })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name: string;

    @ApiProperty({ description: 'Contact message', example: 'I would like to inquire about...' })
    @IsString()
    @MinLength(10)
    @MaxLength(5000)
    message: string;

    @ApiProperty({ description: 'Contact email', example: 'john@example.com' })
    @IsEmail()
    @MaxLength(255)
    email: string;

    @ApiProperty({ description: 'Contact phone', example: '+1234567890', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone: string;
}

export class UpdateContactDto {
    @ApiProperty({ description: 'Contact name', required: false })
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name?: string;

    @ApiProperty({ description: 'Contact message', required: false })
    @IsOptional()
    @IsString()
    @MinLength(10)
    @MaxLength(5000)
    message?: string;

    @ApiProperty({ description: 'Contact email', required: false })
    @IsOptional()
    @IsEmail()
    @MaxLength(255)
    email?: string;

    @ApiProperty({ description: 'Contact phone', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;
}

export class ContactQueryDto {
    @ApiProperty({ description: 'Contact ID', required: false })
    @IsOptional()
    @IsUUID()
    id?: string;

    @ApiProperty({ description: 'Contact name', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiProperty({ description: 'Contact message', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    message?: string;

    @ApiProperty({ description: 'Contact email', required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ description: 'Contact phone', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;

    @ApiProperty({ description: 'Created date range', required: false })
    @IsOptional()
    createdAt?: DateRange;

    @ApiProperty({ description: 'Updated date range', required: false })
    @IsOptional()
    updatedAt?: DateRange;
}