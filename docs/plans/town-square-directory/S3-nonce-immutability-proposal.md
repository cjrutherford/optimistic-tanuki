# S3 event-nonce immutability proposal

**Status: implemented in a local Social migration; not deployed.** A replay fence needs a Social outbox event's `eventNonce` to remain stable after insertion. The existing unique constraint prevents duplicate values but permits updating a nonce. TypeORM schema generation does not express PostgreSQL triggers.

Proposed reversible migration, created by the owning service's TypeORM CLI `migration:create` target, after an explicit exception to the repository's generator-only schema rule:

```sql
-- up
CREATE FUNCTION community_directory_nonce_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."eventNonce" IS DISTINCT FROM OLD."eventNonce" THEN
    RAISE EXCEPTION 'community directory event nonce is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER community_directory_nonce_immutable
BEFORE UPDATE ON community_directory_change
FOR EACH ROW EXECUTE FUNCTION community_directory_nonce_immutable();

-- down
DROP TRIGGER IF EXISTS community_directory_nonce_immutable ON community_directory_change;
DROP FUNCTION IF EXISTS community_directory_nonce_immutable();
```

The trigger permits updates to other fields and permits unchanged nonces. It does not restrict database owners or superusers from disabling it, and it is not a restore fence by itself. Validate insert, same-nonce update, changed-nonce rejection, transaction rollback, and reversible migration on fresh and upgraded disposable PostgreSQL databases; run the owning service's Nx migration targets and repository migration validator. Review the actual generated migration and SQL before deployment.

## Local verification (2026-11-04)

The owning Social TypeORM CLI created `1793841099025-CommunityDirectoryNonceImmutable.ts` using `migration:create`, under the explicitly authorized trigger-only exception. The migration uses the SQL above; no other manual schema exception was used. On a disposable `postgis/postgis:17-3.5` container, the Social Nx migration run target applied the chain to a fresh database and applied the trigger to a database containing existing outbox events. The focused `nonce-immutability.test.js` initially failed before the trigger and then passed for both databases: insert, unchanged nonce with another field changed, rejection of a changed nonce, and transaction rollback. Social's Nx revert and run targets were used to remove and reapply the migration on each database; removal of both trigger and function was checked in PostgreSQL. The repository migration validator passed. These are local database checks, not deployment or a restore drill.
