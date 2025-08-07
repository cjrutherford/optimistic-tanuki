import { PartialType } from '@nestjs/mapped-types';
import { CreateKeyDatumDto } from './create-key-datum.dto';

/**
 * Data transfer object for updating an existing key datum.
 */
export class UpdateKeyDatumDto extends PartialType(CreateKeyDatumDto) {
  /**
   * The unique identifier of the key datum.
   */
  id: number;
  /**
   * The public key (optional).
   */
  pub?: string;
  /**
   * The salt used for key generation (optional).
   */
  salt?: string;
}
