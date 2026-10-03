# ADR: civic-briefing and Civic Core

- **Status:** accepted (owner, 2026-10-03)
- **Plan slice:** P2.6 of `docs/plans/2026-09-30-daylight-civic-briefing-integration.md`

## Context

Two services now handle municipal records.

**`apps/civic` (Civic Core)** sits behind the `whitebox-civic-core` portal.

- It is multi-tenant: a municipality is a tenant, and every agenda source
  needs a `tenantId`.
- It polls configured agenda indexes. It has parsers for Savannah's Agenda
  Plus HTML and MPC's PDF index.
- It keeps TIP (transportation improvement) projects and emergency
  broadcasts.
- Its data is the municipality's own, published through its own portal.

**`apps/civic-briefing` (Towne Square)** reads public sources about towns.

- Its adapters cover CivicPlus AgendaCenter, Legistar, Granicus,
  CivicClerk, documents, RSS, open data and email.
- It synthesises daily briefings per locality.
- Its sources are found and judged by the pipeline, not operated by the
  town.

Both ingest agendas, and they know nothing of each other. The source
outreach plan (`docs/plans/2026-10-02-civic-source-outreach-plan.md`)
wants municipalities to send official material directly. Civic Core is
already a way for a municipality to publish.

## Decision

1. **Civic Core is a first-party source for civic-briefing.** For a town
   with a Civic Core tenant, civic-briefing reads that tenant's agendas,
   emergency broadcasts and TIP projects from `apps/civic` over TCP
   (`ServiceTokens.CIVIC_SERVICE`, the existing `CIVIC_GET_*` message
   patterns). The data is the town's own, so it ranks as an official
   record: it grounds briefing claims as the town's documents do, and
   civic-contributions can check reports against it.
2. **The services stay separate.** Civic Core keeps its tenant model, its
   portal and its parsers. civic-briefing doesn't write to Civic Core, and
   Civic Core doesn't depend on civic-briefing.
3. **Emergency broadcasts appear in the matching town's briefing as
   alerts,** like NWS alerts today. **TIP projects become development or
   infrastructure stories,** carrying their funding and status.
4. **A tenant is matched to a town by name and state** (owner's choice
   over an explicit mapping), with these safeguards:
   - **The state must match exactly.** The tenant's state and the
     locality's `state` are compared as two-letter codes.
   - **The name is normalised** as the .gov directory matcher normalises
     it: case, punctuation, and a leading "City of", "Town of" or
     "Village of".
   - **A tenant must match exactly one local-government locality (any town, city, village or county in the registry, edition or not; the owner chose the stricter pool).** If it matches
     none, or more than one, it isn't used, and the operator sees why.
     Namesakes in the same state (a Madison town and a Madison County)
     must be resolved by `kind` (city or town vs county), never guessed.
   - **Every match is logged** with its evidence, and admin overrides
     (D9, SD.6) can pin or block a match.

## Consequences

- **A municipality on Civic Core gets into its town's briefing without
  being discovered.** That fits the outreach goal of officials onboarding
  themselves.
- **civic-briefing gains a `civic-core` source adapter** that reads over
  TCP, not HTTP. It is the second non-HTTP adapter after email, and it is
  live-only, so it isn't part of the parity corpora.
- **Agenda parsing stays duplicated.** Civic Core's Agenda Plus and MPC
  parsers aren't shared with civic-adapters for now. Revisit if a briefing
  town uses either platform without being a Civic Core tenant.
- **Civic Core's tenant data needs a state.** If the tenant entity lacks a
  two-letter state, that field is added to `apps/civic` with a generated
  migration.
- **Retention:** broadcasts expire, so briefings show them only while
  they're active.

## Follow-up work

A new plan slice, **P2.6a** (after Phase 3), covers:

- the `civic-core` adapter;
- tenant-to-locality matching with the safeguards above;
- broadcast alerts and TIP stories;
- tests, including the same-name cases.
