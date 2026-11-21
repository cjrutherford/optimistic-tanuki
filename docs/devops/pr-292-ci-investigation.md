# PR 292 CI investigation

## PR 298 playground coverage correction

The playground's Jest configuration did not collect unimported source files. Its two suites inspect Storybook files as text, so CI produced an empty coverage summary despite passing tests. The configuration now collects all playground `src` TypeScript, excluding specs and test setup; both the validation board and its story are included.

On `58b3fd35` with this change, `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx test ui-playground --configuration=ci --skip-nx-cache --runInBand` passed 2 suites and 4 tests. Coverage is 0/55 statements, 0/1 branches, 0/10 functions and 0/54 lines (0% each): the component is still untested. The four reported metrics are numeric; Istanbul's unused `branchesTrue` field remains `Unknown` because its total is zero.

At the PR check snapshot before this fix, coverage and quality tests passed; image checks for `ui-playground` and `admin-api` and the digital-homestead Lighthouse check were pending. Earlier image runs reported Docker Hub 429 as documented below; pending checks are not evidence of a new failure.

Snapshot: 2026-11-21 19:21 UTC. Base: `47a8b0fe65ee2bbc7cf88b02300b5d1c9ddac033`; PR head: `ec1165386abe264333cf205daef9cea320549374`. The PR run checked out merge ref `f387eba67ef1e0d1486febcc67fb31625f705468`. Paginated Actions runs and check-runs were inspected for the head, merge ref and merge commit. The merge-ref check-runs endpoint returned no separate checks.

[PR CI/CD run](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057) has 42 failed image jobs and a failed summary. All 42 job logs report Docker Hub HTTP 429 when pushing or checking manifests. The summary is consequential; seven downstream jobs were skipped. Quality, coverage, workflow validation, package validation, security scan and performance workflows reported success. Skipped E2E and staging gates are not evidence of success.

[Main CI/CD run](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44934874601) was still running: eight image jobs had failed with the same 429, with further jobs queued or in progress. Other main workflows visible at the snapshot succeeded. These results are provisional.

## Follow-up: registry pressure mitigation

The failed [representative image job](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936522913) used `docker/login-action@v4` and logged `Login Succeeded`; `docker/build-push-action@v6` then failed on a registry manifest digest HEAD with `429 Too Many Requests`. Buildx did not expose response headers, a response body, or `Retry-After`. Both Docker Hub secret names exist; their values were not examined. Docker documents a bare 429 as consistent with its [abuse rate limit](https://docs.docker.com/docker-hub/troubleshoot/), and distinguishes it from the explicit [pull quota message](https://docs.docker.com/docker-hub/usage/pulls/). The exact limit and scope cannot be proven without the missing response details; push quota or another registry condition cannot be excluded.

The workflow already limited each matrix to four concurrent jobs; PRs push SHA images for E2E and main separately builds and publishes images. Overlapping runs can therefore multiply traffic. This change reduces both image build and promotion matrices to two and limits each image builder to two concurrent BuildKit operations. It retains every matrix entry, login, image push, and downstream gate. It does not serialize separate workflow runs; GitHub concurrency groups can cancel pending runs and would compromise required gates. No retry was added: the action does not expose the registry response headers needed to honor Retry-After, and retrying a full build blindly would amplify persistent failures. These limits reduce pressure, but do not guarantee recovery from an external limit.

| Evidence                                                                                      | Result                                                                                                                                                   |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PR CI/CD jobs](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057)   | Paginated: 42 image failures, consequential summary failure, seven skips, 17 successes; no canceled jobs. Other head workflows succeeded.                |
| [Main CI/CD jobs](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44934874601) | Paginated follow-up: eight image failures, 33 successes, four in progress and 14 queued; run remains incomplete. Other visible main workflows succeeded. |
| Local registry workflow contract                                                              | `node --test scripts/tests/registry-workflow-contract.test.mjs` passed; checks matrix limits and failure propagation to gates.                           |

The main inventory remains provisional while jobs are running. Fresh CI must establish whether the registry accepts all images and whether the previously skipped E2E and staging gates pass. No account settings, secrets, or registry contents were changed during this investigation.

## Failed PR jobs

- [Image Check - christopherrutherford-net](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936522913) — failure
- [Image Check - civic](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936522948) — failure
- [Image Check - civic-contributions](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936523113) — failure
- [Image Check - civic-briefing](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936523166) — failure
- [Image Check - client-interface](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936524162) — failure
- [Image Check - classifieds](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936524200) — failure
- [Image Check - compliance-audit](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936524220) — failure
- [Image Check - configurable-client](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936524227) — failure
- [Image Check - developer-portal](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936524234) — failure
- [Image Check - d6](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936524267) — failure
- [Image Check - digital-homestead](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936524302) — failure
- [Image Check - finance](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936524369) — failure
- [Image Check - fin-commander](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936524431) — failure
- [Image Check - forgeofwill](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936524492) — failure
- [Image Check - forum](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936525166) — failure
- [Image Check - gateway](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936525294) — failure
- [Image Check - leads-app](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936525388) — failure
- [Image Check - lead-tracker](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936525415) — failure
- [Image Check - hai](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936525416) — failure
- [Image Check - learning](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936525467) — failure
- [Image Check - learning-runner](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936525507) — failure
- [Image Check - local-hub](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936525512) — failure
- [Image Check - learning-service](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936525538) — failure
- [Image Check - marketing-generator](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936525757) — failure
- [Image Check - owner-console](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936526518) — failure
- [Image Check - payments](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936526606) — failure
- [Image Check - profile](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936526617) — failure
- [Image Check - permissions](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936526648) — failure
- [Image Check - prompt-proxy](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936526694) — failure
- [Image Check - social](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936526726) — failure
- [Image Check - project-planning](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936526738) — failure
- [Image Check - store](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936526821) — failure
- [Image Check - store-client](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936526933) — failure
- [Image Check - system-configurator](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936526984) — failure
- [Image Check - telos-docs-service](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936527693) — failure
- [Image Check - system-configurator-api](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936527707) — failure
- [Image Check - video-client](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936527750) — failure
- [Image Check - video-transcoder-worker](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936527771) — failure
- [Image Check - ui-playground](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936527817) — failure
- [Image Check - videos](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936527863) — failure
- [Image Check - wellness](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936527954) — failure
- [Image Check - workspace](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136936528079) — failure
- [Summary](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44931051057/job/136950224891) — failure

## Failed main jobs at snapshot

- [Image Check - assets](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44934874601/job/136948621213) — failure, Docker Hub 429
- [Image Check - blogging](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44934874601/job/136948621242) — failure, Docker Hub 429
- [Image Check - admin-api](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44934874601/job/136948621256) — failure, Docker Hub 429
- [Image Check - app-configurator](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44934874601/job/136948621262) — failure, Docker Hub 429
- [Image Check - authentication](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44934874601/job/136948621264) — failure, Docker Hub 429
- [Image Check - ai-orchestrator](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44934874601/job/136948621272) — failure, Docker Hub 429
- [Image Check - bug-report](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44934874601/job/136948621282) — failure, Docker Hub 429
- [Image Check - business-configurator](https://github.com/cjrutherford/optimistic-tanuki/actions/runs/44934874601/job/136948621325) — failure, Docker Hub 429
