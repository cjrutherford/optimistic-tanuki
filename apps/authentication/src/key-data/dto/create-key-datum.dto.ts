/**
 * Data transfer object for creating a new key datum.
 */
export class CreateKeyDatumDto {
    /**
     * The salt used for key generation.
     */
    salt: string;
    /**
     * The public key.
     */
    pub: string;
    /**
     * The user ID associated with the key datum.
     */
    user: string;
}
