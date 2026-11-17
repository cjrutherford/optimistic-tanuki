const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');

for (const name of ['FRESH', 'UPGRADED']) {
  const url = process.env[`SOCIAL_NONCE_${name}_DATABASE_URL`];
  test(
    `event nonce is immutable on ${name.toLowerCase()} database`,
    { skip: !url },
    async () => {
      const client = new Client({ connectionString: url });
      await client.connect();
      try {
        const communityId = randomUUID();
        const [{ eventNonce, revision }] = (
          await client.query(
            'INSERT INTO community_directory_change ("communityId", operation) VALUES ($1, $2) RETURNING "eventNonce", revision',
            [communityId, 'changed']
          )
        ).rows;
        await client.query(
          'UPDATE community_directory_change SET "eventNonce" = $1, operation = $2 WHERE revision = $3',
          [eventNonce, 'deleted', revision]
        );
        await client.query('BEGIN');
        await assert.rejects(
          client.query(
            'UPDATE community_directory_change SET "eventNonce" = $1 WHERE revision = $2',
            [randomUUID(), revision]
          ),
          /event nonce is immutable/
        );
        await client.query('ROLLBACK');
        const [event] = (
          await client.query(
            'SELECT "eventNonce", operation FROM community_directory_change WHERE revision = $1',
            [revision]
          )
        ).rows;
        assert.deepEqual(event, { eventNonce, operation: 'deleted' });
        await client.query(
          'DELETE FROM community_directory_change WHERE revision = $1',
          [revision]
        );
      } finally {
        await client.end();
      }
    }
  );
}
