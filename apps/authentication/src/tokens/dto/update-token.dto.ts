import { PartialType } from '@nestjs/mapped-types';
import { CreateTokenDto } from './create-token.dto';

/**
 * Data transfer object for updating an existing token.
 */
export class UpdateTokenDto extends PartialType(CreateTokenDto) {
  /**
   * The unique identifier of the token.
   */
  id: number;
  /**
   * Indicates whether the token is revoked (optional).
   */
  revoked?: boolean;
}
