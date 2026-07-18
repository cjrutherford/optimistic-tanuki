# MetroCast Locality Platform Evaluator Guide

This guide evaluates the Slice 16.1 campaign workflow across Studio, Towne
Square, and MetroCast. It assumes the development stack has been bootstrapped
and seeded.

## Preflight

Run:

```bash
pnpm run docker:dev:bootstrap
```

Open the local dashboard at `http://localhost:8099`, or use the direct routes:

- Towne Square: `http://localhost:8087`
- MetroCast: `http://localhost:8093`
- Studio: `http://localhost:8094`
- Gateway API documentation: `http://localhost:3000/api-docs`

Seeded Studio owner:

- Email: `owner-accountant@localbusiness.test`
- Password: `BusinessOwnerPass123!`

## Journey 1: Confirm Locality Convergence

1. Open Towne Square and select the seeded Savannah locality/community.
2. Confirm the locality page links to nearby MetroCast channels and hosted
   Studio businesses.
3. Confirm any sponsored banner is labelled `Sponsored` and is populated from
   an active campaign on-page creative.
4. Open MetroCast and confirm the Local Scene identifies the same locality.
5. Confirm nearby channels and businesses use the same locality context rather
   than a separately seeded city table.

Expected result: Towne Square acts as the locality hub, while MetroCast and
Studio destinations preserve the same community/business context.

## Journey 2: Create a Multi-Target Campaign

1. Open `http://localhost:8094/auth` and sign in with the seeded Studio owner.
2. Open the `Campaigns` workspace at `http://localhost:8094/owner/campaigns`.
3. Enter a campaign name, date window, optional budget, headline, body, and CTA.
4. Select at least one community and one MetroCast channel.
5. Confirm a community offers only `on-page` placement.
6. Confirm a channel offers `pre-roll`, `mid-roll`, `post-roll`, and `on-page`.
7. Choose placements independently for each target and create the draft.
8. Activate the campaign.

Expected result: the campaign is listed as active with the selected target
placement count. Activation is rejected if a selected placement lacks its
campaign-level creative.

## Journey 3: Verify Viewer Delivery

1. Return to the selected Towne Square community and refresh.
2. Confirm the active community `on-page` campaign appears in the sponsorship
   banner.
3. Open MetroCast. Confirm locality discovery resolves the current community
   before requesting eligible campaigns.
4. Confirm the active campaign appears in `Local Sponsors` and its CTA resolves
   to the hosted Studio business or configured campaign URL.
5. Open a specifically targeted channel and confirm its active `on-page`
   campaign appears in the channel supporter rail.

Expected result: only active campaigns inside their date window, with a matching
community/channel target and an on-page creative, are rendered.

## Journey 4: Lifecycle Controls

1. Pause the active campaign in Studio and refresh Towne Square and MetroCast.
2. Confirm it no longer appears on viewer surfaces.
3. Reactivate it and confirm it becomes eligible again.
4. Archive it when finished and confirm it remains unavailable for delivery.

## Journey 5: Creator-to-Viewer Live Handoff

1. Sign in to MetroCast with the seeded owner and open `My Channel`.
2. Start a live session for a seeded channel. A source URL is optional for
   this slice; omit it to validate the handoff state without a media provider.
3. Open the channel's live link, or navigate directly to
   `http://localhost:8093/watch/live/<channel-slug>`.
4. Confirm the live player transitions through `Connecting` to `Live now`.
5. Confirm the page identifies the active session and shows the five-minute
   handoff expiry. Without a source URL it should explain that the media source
   is not yet attached rather than showing a broken player.
6. Stop the live session in `My Channel`, refresh the live route, and confirm
   the viewer sees the ended/offline state and no token is issued.
7. Allow browser location access. For a running live session, submit the token
   with the same latitude and longitude to
   `POST /api/videos/channels/<channel-slug>/live/token/validate` and confirm
   it is valid. Change one character in the token and confirm validation fails.
8. The live handoff now sends an opaque browser session identifier, accuracy,
   and observation timestamp. These are recorded only for trust assessment:
   a `suspicious` response displays an informational message and does not
   interrupt playback.

For API-level validation, use the public feed endpoint followed by:

```bash
curl -X POST http://localhost:3000/api/videos/channels/<channel-slug>/live/token \
  -H 'content-type: application/json' \
  -d '{"viewerLat":32.0809,"viewerLng":-81.0912,"viewerSessionId":"evaluator-session","viewerAccuracyMeters":15,"observedAt":"2026-07-18T18:00:00.000Z"}'
```

The token endpoint returns `status: ready` only for an active live session
inside its channel-anchor radius. A returned `localityTrust` object is
observe-only in this slice and does not alter that decision. Use the same
coordinate pair and telemetry values when validating:

```bash
curl -X POST http://localhost:3000/api/videos/channels/<channel-slug>/live/token/validate \
  -H 'content-type: application/json' \
  -d '{"token":"<issued-token>","viewerLat":32.0809,"viewerLng":-81.0912}'
```

Scheduled and inactive channels return `status: unavailable` with null token
and expiry fields. This is browser-coordinate enforcement only; it is not
anti-spoofing.

Set `LIVE_PLAYBACK_TOKEN_SECRET` in production. The validation endpoint is the
media-gateway contract; it verifies signature, expiry, requested community, and
the currently active live session before returning a playback source.

## Journey 6: Automated Broadcast Continuity

1. Create or use a seeded channel with a prerecorded schedule block.
2. Confirm the block's start and end times bracket the current time, then wait
   for one scheduler interval or request the channel feed.
3. Confirm the feed reports `scheduled` and the active block/video IDs.
4. After the block ends, request the feed again and confirm the scheduler
   resolves replay continuity when a completed prerecorded block is available.
5. For a channel with no current program or replay, confirm the feed reports
   `offline` unless `BROADCAST_FILLER_VIDEO_ID` is configured.
6. If a creator starts a live session during a scheduled block, confirm the
   feed reports `live`; the scheduler must not replace the live session with a
   program, rerun, filler, or ad.

The worker defaults to a 15-second interval. Development operators can set
`BROADCAST_SCHEDULER_ENABLED=false` to disable it, or change
`BROADCAST_SCHEDULER_INTERVAL_MS` and `BROADCAST_FILLER_VIDEO_ID` before
starting the videos service.

## Journey 7: Local Playback Ad Eligibility

1. In Studio, create a campaign with a seeded MetroCast channel target and a
   `pre-roll` creative URL.
2. Set the campaign dates to include the current time and activate it.
3. Confirm the targeted channel has a scheduled block, then wait for the
   scheduler interval or request its feed.
4. Confirm the scheduler can resolve the campaign as a channel-anchor match.
5. Change the campaign to paused or move its end date into the past, then
   confirm the next eligibility lookup excludes it.
6. Confirm a campaign targeted only at another channel or community does not
   appear for the current channel.
7. Start a live session and confirm live precedence wins over any ad candidate.

The scheduler uses the payments service contract internally. The contract is
also available through the existing payments service boundary as
`payments.getEligiblePlaybackCampaigns` with `channelId`, `communityId`, and
`placementType`.

## Deferred Behavior

Slice 16.1 stores pre-roll, mid-roll, and post-roll campaign placements but does
not insert them into playback. Automated playlist insertion belongs to the
broadcast scheduler and campaign delivery slices. Checkout, impression pacing,
automatic billing, and per-target creative overrides are also intentionally
deferred.

Slice 17 does not provide a production HLS/WebRTC ingest service. It validates
the passive-to-live application handoff and exposes the media-source boundary
for the scheduler and transport integration slices.

Slice 18 establishes playlist precedence and automated feed transitions. It
does not choose ads by locality or deliver campaign media; those concerns are
deferred to Slice 19 and the production media transport integration.

Slice 19 establishes direct channel/community anchor matching. It does not yet
perform viewer-radius scoring, polygon matching, impression pacing, or ad
billing.

## Evaluation Checklist

- Community donations still work independently of advertising campaigns.
- No legacy sponsorship checkout or sponsor-inventory endpoint is exposed.
- Communities cannot select video-roll placements.
- Channels can independently select all four placement types.
- Paused, archived, expired, or creative-incomplete campaigns are not eligible.
- Towne Square and MetroCast render campaign creatives through the shared
  campaign eligibility API.
