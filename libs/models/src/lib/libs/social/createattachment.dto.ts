import { ApiProperty } from "@nestjs/swagger";

export class CreateAttachmentDto {
  @ApiProperty()
  url: string;
  
  @ApiProperty()
  type: string;
  
  @ApiProperty()
  post: string
}
