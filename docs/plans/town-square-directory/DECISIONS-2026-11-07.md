# User decisions — 2026-11-07

The user approved the working proof of concept as complete for local evaluation. Acceptance is scoped; a deferral is not evidence of completion. Continue independently through authorized work and report milestones.

- **S0:** Finish original acceptance before closing, including the outstanding inventory, exclusions, census and operating decisions.
- **S1:** Accept the local infrastructure milestone. Track production operations and recovery under S9; this does not assert they have been demonstrated.
- **S2:** Complete boundaries and privacy lifecycle before closing the full slice. Use verified boundaries where available and clearly label any fallback.
- **S3:** Confirm the accepted local pending-only milestone is complete. Track production work separately.
- **S4a.1:** Prepare a clear operation-by-operation source limitations and notice matrix for user decision. Identify and implement applicable conditions; exclude or ask about uses that cannot be supported.
- **Real acquisition:** Do not acquire yet. Prepare a concrete release and cost proposal.
- **S4a.2:** Prepare a short quality protocol and proposed thresholds for user approval before sampling. Keep residential and sensitive records blocked pending review; adult records require explicit opt-in.
- **S4a.3:** Prepare a bounded public rollout proposal for review; public rollout is not authorized by this decision.
- **S4b/c:** Review each other provider's limitations and present options.
- **S5/S6:** The underlying API must be a microservice served through the gateway. Build on existing UI libraries; put new UI components in a new UI library. Only pages belong in the final app.
- **S7:** Build essential private operator controls before public rollout. The private operator surface belongs in the owner console project. Implement an authenticated operator workflow and verify removal from every visible surface.
- **S8:** Prepare a restricted export proposal for review; export is not authorized by this decision.
- **S9:** Start a production-readiness plan alongside implementation. Carry S1 production operations/recovery and S3 production work here as explicit follow-ups, without implying they were completed.
- **S10:** Produce a scorecard distinguishing complete, deferred and unknown capabilities.
- **People:** Propose a simple role-based acceptance and review process for approval.
- **Budget (subsequent user instruction):** The current budget is $25 per month. The ceiling is shared across all providers, all towns and retries; every billed request counts. The alert, provider accounting and enforceable hard-stop mechanism still need verification. This budget does not by itself identify an approved provider, release or source operation; the prior instruction not to acquire real source records yet remains in force.
- **Other constraints:** No additional decision provided.

Unanswered source-use, acquisition, public-release and export questions are not authorization. Continue independent work that does not require them.

- **Sequencing (subsequent user instruction):** Close the remaining S0–S3 gaps, then complete S4. Preserve the accepted local scope of S1 and S3 while addressing remaining production obligations, with S9 retaining the production-readiness record.

- **Census source:** The user clarified that the existing local `ot_social` database represents the intended Social source for this deployment, while Directory must have its own separate database. Social remains the source of town eligibility and privacy; the Directory database holds its own directory state.
- **Development fixtures:** Exclude explicitly marked development fixtures from Directory eligibility. The currently observed source marker is the exact administrative-area value `Development fixture`; do not exclude non-system communities in general or silently guess that other towns are fixtures.

- **Role responsibilities:** Approved the [role-based process](S0-review-roles-proposal.md), including one person holding multiple roles. This does not assign individuals or separately approve source use, spending or rollout.
- **Operating targets:** The user approved daily town reconciliation; detection and queueing of 99% of eligible changes within 24 hours; refreshing approved source data at least every 90 days and marking it stale after 120 days; and removing withdrawn information from public surfaces within 24 hours, with an alert if missed. These are first-deployment targets, not established performance; stricter applicable source/privacy requirements still apply. The previously discussed seven-day town completion goal and 12-month retention maximum were not included in this approval and remain proposals. The separately selected 15-minute pending-onboarding target remains as previously recorded.

- **Initial private Overture pilot towns:** Prepare Douglas, Tifton, Valdosta and Waycross, Georgia. This selects the proposed pilot scope only; source-use conditions, a concrete cost proposal and separate acquisition approval are still required.
- **Private quality review effort:** Plan for 400 randomly selected records and two reviewers. Final protocol, thresholds, sampling frame, cost, disagreement resolution and authorization to sample remain open; no third reviewer was approved by this selection.
- **Missing verified town boundaries:** Provide a clearly labeled approximate location where one is available, and keep boundary-dependent searches pending until the boundary is verified. This does not establish that a reference point is available or authorize a fabricated radius or public serving before privacy/lifecycle checks.

- **Boundary review standard (approved 2026-11-08):** An authenticated reviewer may verify a town boundary by confirming the Census identifier and boundary against an official government source, recording the source and decision, and leaving ambiguous cases pending. This approves the standard, not any individual boundary or public rollout.
- **Outer Banks and Kill Devil Hills (2026-11-08):** Keep both as separate communities. The user reiterated that they should remain separate. No regional boundary was specified; use the previously approved labeled approximate fallback while its area is unverified, and review Kill Devil Hills independently. Do not change the Social records.

## 2026-11-08 — public display of mixed-source fields

The user chose: show only fields whose source license and required notices can be verified; hide unknown or conflicting fields. This is the public-display policy direction for mixed-source business records, not authorization for paid requests, real-source acquisition, a specific quality protocol or public launch. Source-specific license obligations and privacy rules still apply, and no field is cleared solely by this decision.

The user also chose to include otherwise verified, freely usable fields when their license requires credits or a license notice, provided those required notices are supplied. Unknown or conflicting fields stay hidden. This does not authorize an acquisition, paid request, or public launch.

The user chose to include verified business websites when the source license permits display and the value is a valid public web URL. A syntactically valid URL alone is not evidence that it belongs to the listed business; source/field rights and any required notices remain mandatory. This expands the desired public field scope but does not itself approve acquisition or launch.

The user chose to include verified, publicly listed business phone numbers when source terms permit. Numbers whose business/public status is uncertain, including potentially personal or residential numbers, remain hidden. This is a field-scope decision, not approval to acquire records or launch.

The user chose to show verified street addresses publicly listed as business locations when source terms permit. Residential or uncertain addresses remain hidden until resolved. This is field-scope direction, not approval to acquire records or launch.

The user chose to require explicit opt-in for adult-oriented businesses. The exact operator and visitor opt-in mechanism remains a separate question; this choice does not permit an unclassified adult listing or authorize launch.

For the public directory the user selected **visitor-only** opt-in for adult-oriented listings, superseding the earlier proposed operator-plus-visitor gate. Adult listings stay hidden until an appropriate visitor opt-in and classification are implemented; the prior private POC's operator-only setting does not prove that control exists. This does not override other applicable user choices or authorize release.

The user chose to keep potentially sensitive locations hidden until a reviewer confirms public display is appropriate, even where a source license permits display. This is a review requirement, not approval of a specific location or release.

For the proposed 400-record quality review, the user chose to review every eligible record and report the actual smaller count if the entire eligible frame has fewer than 400 records. This does not by itself approve the sampling frame, all thresholds, source acquisition or public launch.

For quality-review disagreements, the user chose independent initial reviews followed by comparison of evidence. Any unresolved disagreement makes the affected part of the pilot inconclusive. This does not require a third adjudicator and does not approve other sampling or quality thresholds.


## 2026-11-08 — complete quality review frame

The user clarified “don't limit”: both reviewers should independently review **every eligible record** across Douglas, Tifton, Valdosta and Waycross, even if the frame contains tens of thousands of records. This supersedes the earlier 400-record random sample and smaller-frame rule. The full frame, thresholds, review evidence, any separate merge-pair method, source acquisition and spending remain subject to their own decisions.


## Quality thresholds — complete eligible frame

The user chose a maximum duplicate rate of **1%** and a maximum junk rate of **5%** across the complete eligible frame. Duplicate means an extra record representing the same business at the same location; junk means a record that cannot reasonably represent a distinct business in the selected town. Exact counting rules and the remaining thresholds still require protocol completion.

The user chose a maximum of **10%** of eligible records missing or unable to publish required listing information, including a verified name, business location, category or required attribution. This is an aggregate quality limit; it does not authorize publication of an individual record whose required information is missing or whose rights are unverified.

The user chose a maximum **5%** rate for records assigned to the wrong town or outside its verified boundary, measured across the complete eligible frame. This quality threshold does not authorize displaying an individual record in a town when its assignment is known to be wrong or unverified.

The user chose a maximum **2%** incorrect-merge rate among proposed merges checked. Whether to review every proposed merge or use a sample remains a separate decision, as do the precise pair definition and any sampling method. Known or unresolved incorrect merges are not authorized for publication.

The user chose that **both reviewers independently examine every proposed merge**, with no sampling. If reliable evidence cannot be found using freely accessible sources, the affected listing or merge assessment remains inconclusive rather than guessed. These choices do not approve source acquisition, spending or publication.

If there are **no proposed merges**, report the merge check as **not applicable** and make no claim that the merge process has been validated.

Each pilot town must meet the applicable quality limits in its own results, as well as reporting the combined results. A good combined result cannot override a town's failure. Town assignment for merge decisions must be fixed in the rubric, and a town without proposed merges has an inapplicable merge check rather than a validation claim.

A pilot town with no eligible records remains **inconclusive** for listing quality; other towns may still be assessed independently.

If a town fails an applicable quality limit, correct the data and conduct a fresh review before calling that town passed; do not change limits after seeing results. The new review must use a frozen, documented frame and the agreed full review process.


## Private use of October 2026 Overture Places

The user approved private use of Overture Places release **2026-10-21.0** for the four-town quality review, provided exact field licenses and required notices are checked and unknown or conflicting rights are quarantined. This is private-use approval; it does not authorize paid requests, public display, export or launch, nor does it approve unresolved retention rules or establish an enforceable spending cap. The specific acquisition procedure and operational safeguards remain to be completed.


The user chose to retain the private pilot's copy of business records **until explicitly deleted**, rather than deleting automatically when the review ends or after 90 days. This does not override a source's shorter retention restriction, a rights withdrawal, the user's previously approved withdrawal target, or a future deletion request. Actual deletion authority and verification must be implemented before real data use.

## Revised objective — live Town Square directory

The user directed that the goal is to build the directory into Town Square and get it live and running, rather than treating a private pilot as the destination. Proceed through the public integration and launch work, including the previously sequenced API, UI and essential operational controls. Earlier field-rights, notice, sensitive-location, visitor opt-in, quality, budget and deletion decisions remain applicable unless changed. The user was asked which running environment is the launch target. The existing $25 shared ceiling is not by itself a reliable upper bound on unpriced requests; determine actual costs and enforceable controls before incurring charges.


The user clarified the immediate launch target: the existing **local development Docker stack**. The user will decide about public deployment after evaluating it. Build and operate the local Town Square experience; do not treat this as permission to deploy to a public environment.

For local development evaluation, the user approved displaying source-permitted records before the previously selected two-person full review, while keeping uncertain and sensitive fields hidden. This is a local evaluation exception; it does not authorize public deployment or waive the source-rights and privacy rules.

For local development evaluation, the user approved temporarily using the POC's existing town assignments, provided they are clearly marked **unverified**. This supersedes the pending-only rule for this limited local listing context; it does not establish a verified boundary or approve public deployment.

## 2026-11-10/11 — local address review and publication

The user approved, for the local development stack only:

- public display of the address, website and phone fields for all active directory towns, with export still disabled;
- rule-based residential, sensitive and adult classification, with human review for unknown or high-risk cases;
- bounded HTTP and HTTPS official-page evidence with robots, rate limits, timeouts, body caps and bot detection;
- seeding from active private rows and re-acquiring October contact fields for the 133-town cohort.

The implementation processed the 182,277 active rows, retained 179,394 addresses across 133 towns, matched 181,475 active rows, created 179,125 private candidates, processed a stratified five-per-town evidence sample, and published 53 reviewed rows. This is local-evaluation evidence, not a quality acceptance. The two-reviewer full-frame quality review and the four-town precision measurement remain outstanding.

On 2026-11-11 the user chose **document only for this thread** when asked how to correct the publication and auto-approval findings: make no rollback or data changes now, but the next agent is expected to correct the findings in place, building on the existing queue and publications. The findings and the required follow-up are recorded in `S7-address-review-auto-approval.md` §11 and `HANDOFF-2026-11-11-address-review.md`:

- 120 pilot/import candidates are not bound to the active private row they published;
- the publisher resolves by name, category and point and does not enforce the candidate's source key;
- there is no town-containment gate; the published set includes wrong-town addresses (Valdosta to Quitman three times, Greer to Taylors, Kill Devil Hills to Nags Head);
- auto-approval was enabled at scale before the four-town precision measurement;
- published rows cannot be retracted from the owner console;
- the public-display policy grants all fields, and the sink's contact/provenance retention is opt-in.

No code or data correction was performed under this decision. The operator limitations are documented in `docs/operators/directory-address-review.md`.

## 2026-11-15 — local evaluation review waiver and unresolved candidates

The user waived the two-independent-human-reviewer full four-town review gate **for local evaluation only**. This is not a quality pass, a waiver for public release, approval of the proposed review protocol, or permission to infer unknown source rights. The separate precision, containment, source-rights and public-release requirements remain open.

For the 23 historical review candidates without a unique active source row, the user chose to archive the unresolved candidates while preserving their audit history. Archival retains the original keys and prior decisions; it does not claim that those candidates were matched to active rows or establish a cross-release identity.
