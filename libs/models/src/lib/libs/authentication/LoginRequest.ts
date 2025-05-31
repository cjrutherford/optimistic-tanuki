import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export default class LoginRequest {
  @ApiProperty()
  email: string;
  @ApiProperty()
  password: string;
  @ApiPropertyOptional({ default: false })
  mfa?:string;
}
