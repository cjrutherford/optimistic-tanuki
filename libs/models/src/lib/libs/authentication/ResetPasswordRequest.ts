import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export default class ResetPasswordRequest {
    @ApiProperty()
    email: string;
  @ApiProperty()
  oldPass: string;
  @ApiProperty()
  newConf: string;
  @ApiProperty()
  newPass: string;
  @ApiPropertyOptional()
  mfa?:string;
}