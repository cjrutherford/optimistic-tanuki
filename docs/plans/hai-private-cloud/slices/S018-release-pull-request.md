# S018 — Release Pull Request

## Status

Planned

## Objective

Open the pull request that carries the private-cloud work to `main`, with
everything the owner needs to deploy it and check the result.

## Why this slice exists

Deployment is a manual owner step, and there is no Kubernetes cluster yet.
The agent's deliverable is a PR that is green, reviewable, and reversible, plus
a smoke-test script the owner runs against whatever host they deploy to.

This is the last slice. It follows S019 so the PR includes the validated
campaign URLs.

## Dependencies

S019

## In scope

- open the PR from `feat/hai-private-cloud` to `main`
- drive CI to green
- a bash smoke-test script that takes the base URL as an argument
- rollback notes
- release notes in the PR description

## Out of scope

- Merging the PR (owner's decision)
- Deploying, or changing deployment config, Kubernetes manifests, or
  workflows
- Changing print QR destinations

## Required References

- ../01-CURRENT-STATE.md (Deployment)
- ../07-ACCEPTANCE-CRITERIA.md
- ../08-SLICE-EXECUTION-POLICY.md

## Implementation Requirements

- Before pushing, run build, test, lint, and typecheck for every affected
  project locally and record the results.
- The smoke-test script:
  - lives at `scripts/smoke-test-hai.sh`, is executable, and passes
    `shellcheck`;
  - takes the base URL as its first argument
    (`scripts/smoke-test-hai.sh https://hopefulaspirationsindustries.com`)
    and assumes nothing about how the site is hosted;
  - needs only `bash` and `curl`;
  - checks that every route returns 200 and server-rendered HTML containing
    its expected `<title>` and canonical URL;
  - checks the S019 campaign URLs, query strings included;
  - checks that the contact details from `04-CONTENT-AND-MESSAGING.md` are
    present;
  - does not submit forms or create data; form submission stays a documented
    manual check;
  - prints one pass/fail line per check and exits non-zero if any check
    fails.
- Run the script against a local production build
  (`node dist/apps/hai/server/server.mjs`) before opening the PR.
- Rollback notes describe how to return to the previous release under the
  deployment method in use at release time, not an assumed one.

## Acceptance Criteria

- [ ] PR is open, linked to this thread, and CI is green
- [ ] Smoke-test script passes against a local production build
- [ ] Manual checks the script cannot cover are listed in the PR
- [ ] Rollback documented
- [ ] Owner has been told what is left for them to do (review, merge, deploy,
      run the smoke test)

## Validation

- `scripts/smoke-test-hai.sh http://localhost:4000` passes.
- CI green on the PR.

## Expected Files / Areas

- `scripts/smoke-test-hai.sh`
- PR description (release and rollback notes)

## Completion Notes

_To be filled by the implementing agent._

## Deviations / Blockers

_None unless documented by the implementing agent._
