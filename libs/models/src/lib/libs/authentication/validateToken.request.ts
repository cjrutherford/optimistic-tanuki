import { ApiProperty } from "@nestjs/swagger";

/**
 * Represents a request to validate an authentication token.
 */
export default class ValidateTokenRequest {
    /**
     * The ID of the user whose token is being validated.
     */
    @ApiProperty()
    userId = '';
    /**
     * The authentication token to validate.
     */
    @ApiProperty()
    token = '';
}