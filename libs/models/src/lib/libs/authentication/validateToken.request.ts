import { ApiProperty } from "@nestjs/swagger";

export default class ValidateTokenRequest {
    @ApiProperty()
    userId: string;
    @ApiProperty()
    token: string;
}