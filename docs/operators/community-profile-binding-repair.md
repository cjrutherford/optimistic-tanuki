# Repair a legacy community profile binding

This tool corrects approved memberships already associated with an account when their recorded profile is that account's global profile and exactly one profile exists for the requested app. It does not create memberships, grant approval, change community scope, or alter historical content. It also updates the owner or manager profile binding only when the corresponding account and old profile both match. The existing database write fences remain active.

Run from the repository root with the local PostgreSQL port exposed on `127.0.0.1:5432`. The tool reads `POSTGRES_USER` and `POSTGRES_PASSWORD` from the environment or local `.env`, falling back to the project's local defaults. It connects only to `ot_social` and `ot_profile` on loopback. Do not supply remote connection parameters. Dry run prints counts and scopes, without account IDs:

```sh
node tools/repair-community-profile-binding.mjs --community-slug rr04-public-1791286426299 --app-scope client-interface
```

Review the result and obtain operator authorization before applying. The explicit count must match the newly calculated plan:

```sh
node tools/repair-community-profile-binding.mjs --community-slug rr04-public-1791286426299 --app-scope client-interface --apply --expected-count 1
```

Only `client-interface` and `local-hub` are accepted. The community must have the requested scope, or have legacy `social` scope with `isPrivate=false` and `joinPolicy=public`. To bound locking and review, the tool refuses communities with more than ten approved memberships, even if fewer would be candidates. Missing or wrong-account source profiles and missing or ambiguous targets abort the entire run. The apply transaction locks the community and approved memberships, holds a Profile table SHARE lock and profile row SHARE locks through the Social commit, and checks conditional updates and readback. Profile writes may wait while this runs; normal write fences can reject the repair.

Before updates, a private `before.json` is written under the ignored `.runtime-artifacts/chat-send/legacy-repair-<uuid>/` directory. It contains selected identity rows and must be handled as sensitive operator data. `after-before-commit.json` records the transactional readback, and `committed.json` records successful completion. The files are mode 0600. A failure before Social commit rolls back the transaction. A connection failure during commit or a failure writing the final receipt can leave the outcome uncertain: inspect the database and receipt before any retry. Use the before and after records to design a separately reviewed, conditional reversal only if current rows still match the recorded after state; do not blindly overwrite later changes.

An existing chat conversation's legacy `ownerId` remains historical attribution and is not used for participant delivery. Any later owner maintenance is separate from this repair.
