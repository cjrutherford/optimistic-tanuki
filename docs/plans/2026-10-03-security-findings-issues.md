# P3.3: security findings to file as issues (drafts)

These are drafts for the owner to review. Nothing has been posted. The
Daylight POC found nine problems in platform code (POC plan 2026-09-20,
section 9; upstream drift note). One, the stub virus scanner, was fixed
upstream. The other eight were re-verified at this branch on 2026-10-03,
and **all eight are still present**.

| #   | Proposed issue title                                                              | Evidence                                                                                                                                                                                                             | Severity                      |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | Registration reply returns the password hash and salt                             | `apps/authentication/src/app/app.service.ts` `registerUser` returns `data.user: newUser` (the entity, with `password` and `keyData`); the account bootstrap passes it on and the gateway's `registerUser` returns it | High                          |
| 2   | 8–9 character passwords register but can never sign in                            | `RegisterRequest` `@MinLength(8)` vs `LoginRequest` `@MinLength(10)` (`libs/models/src/lib/libs/authentication/`)                                                                                                    | Medium                        |
| 3   | A permission check passes on a bare action match                                  | `apps/permissions/src/app/roles.service.ts:497` `p.name === permissionName \|\| p.action === permissionName`: a route requiring `create` passes for any `*.create`                                                   | High                          |
| 4   | Updating a profile without a bio erases it                                        | `apps/profile/src/app/profile.service.ts:279` `bio: partialProfile.bio \|\| ''`                                                                                                                                      | Low                           |
| 5   | Sign-in reveals whether an account exists, and its lockout and verification state | `app.service.ts` `login`: `User not found`, lockout and `EMAIL_VERIFICATION_REQUIRED` are thrown before the password is compared, then `Invalid password`                                                            | Medium                        |
| 6   | Microservices listen on 0.0.0.0 with no TCP authentication                        | 27 `apps/*/src/main.ts` set `host: '0.0.0.0'`; compose publishes their ports on the host                                                                                                                             | Medium (deployment-dependent) |
| 7   | `FileValidationService` trusts the declared MIME type and admits SVG              | `libs/storage/src/lib/file-validation.service.ts:28,30,125`: SVG is in the allow-list and only the client-declared type is checked                                                                                   | Medium                        |
| 8   | Local storage builds paths from the asset name (path traversal)                   | `libs/storage/src/lib/local-storage.ts:55,66`: only whitespace is replaced, then `path.join('assets', assetId, data.name)`, so `../` escapes the asset directory                                                     | High                          |

## Suggested fixes (one line each, for the issue bodies)

1. Map the register reply to `{ id, email, emailVerifiedAt }`, and mark
   `password` and `keyData` `select: false` (or exclude them) on the entity.
2. Use one minimum length (10) in `RegisterRequest`, the password policy and
   `LoginRequest`.
3. Match permissions on `name` only, and add a test that `create` doesn't
   satisfy `blog.post.create`.
4. Only set `bio` when the update includes it (`bio ?? existing.bio`).
5. Compare the password first and return one generic error for every
   failure; report lockout and verification only after a correct password.
6. Bind each service to the compose network (not the host), stop publishing
   service ports, and consider TCP auth or mTLS for production.
7. Detect the content type from the bytes (magic numbers), and drop SVG or
   sanitise it.
8. Name stored files by content hash or uuid; never use the client's name in
   a path. Keep the original name as metadata.

## Filed (2026-10-03)

The repository is public, so per the owner these were filed as **private
draft security advisories**. Only maintainers can see them, and they are
published once the fixes land.

| #   | Advisory            | Severity |
| --- | ------------------- | -------- |
| 1   | GHSA-pm99-mq48-rjcm | high     |
| 2   | GHSA-3h5g-92rf-v564 | medium   |
| 3   | GHSA-63c8-f74f-w9q8 | high     |
| 4   | GHSA-x5rv-7pmq-q5f7 | low      |
| 5   | GHSA-j87j-qx4j-6h8g | medium   |
| 6   | GHSA-h4x2-393w-v89h | medium   |
| 7   | GHSA-q977-2c3p-65rw | medium   |
| 8   | GHSA-c9pw-rr3f-5rv2 | high     |
