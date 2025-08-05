import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export default class ResetPasswordRequest {
    @ApiProperty()
    email = '';
  @ApiProperty()
  oldPass = '';
  @ApiProperty()
  newConf = '';
  @ApiProperty()
  newPass = '';
  @ApiPropertyOptional()
  mfa?:string;
}