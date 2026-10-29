# HAI Product & Public-Good Philosophy

**Status:** Normative

**Applies to:** Hopeful Aspirations Industries (HAI) projects unless a project-specific ADR explicitly documents a justified exception.

**Audience:** Contributors, maintainers, agents, reviewers, product/design work, and release planning.

---

## 1. Purpose

Hopeful Aspirations Industries builds software to help people communicate, organize, create, learn, trade, and participate in the places and communities that matter to them.

Our products may be commercial, experimental, personal, civic, or community-oriented, but they should share a common standard:

> **Technology should increase human agency rather than capture it.**

Users are not inventory, engagement metrics are not the purpose of a community, and software should not require manipulation to justify its existence.

This document is a product and engineering constraint, not only brand language.

When implementation, growth tactics, monetization, or convenience conflict with these principles, contributors and agents should surface the conflict rather than silently optimizing around it.

---

## 2. Core principles

### 2.1 People remain in control

A user should be able to understand why they are seeing something, what audience their actions reach, and how to change those choices.

For user-facing products:

- Primary feeds should honor explicit user choices.
- Chronological or directly requested content should not be silently reordered to maximize engagement.
- Discovery, recommendation, trending, and exploration may exist, but should be distinguishable from the user's primary chosen feed.
- Notification systems should inform rather than manufacture urgency.
- Infinite engagement is not a product goal.

**Design test:** If a feature is more successful when a user loses track of their original intent, reconsider the feature.

### 2.2 Privacy means what we say it means

Privacy language is a contract.

- Private content must remain private to its intended audience.
- Public visibility must be explicit and understandable.
- Defaults should favor the least surprising exposure.
- UI restrictions are not sufficient; authorization must be enforced at the service/API boundary.
- Products must not imply stronger privacy guarantees than the implementation provides.
- Changes that broaden visibility require deliberate review and migration behavior.

**Design test:** A reasonable user should not be surprised by who can read, discover, index, or receive their content.

### 2.3 Public spaces should behave like public goods

HAI's community products aim to create useful places on the internet, not merely engagement funnels.

This means:

- Utility comes before extraction.
- Healthy participation is more important than raw time-on-site.
- Durable knowledge and conversation are valuable.
- Communities should be able to establish norms without needing outrage to remain active.
- Where feasible, data portability, interoperability, self-hosting, and federation should be favored because communities should not depend forever on the continued operation of one central website.

Self-hosting and federation are architectural goals where applicable, not claims to advertise before they exist.

### 2.4 Honest software, honest marketing

Marketing must describe the product that users can actually use.

Do not:

- invent user counts, customers, adoption, testimonials, or scale;
- present roadmap features as released features;
- describe placeholders, prototypes, or unverified integrations as production behavior;
- claim security, moderation, privacy, accessibility, reliability, or performance that has not been validated;
- use fake scarcity, fake urgency, or misleading social proof.

Early-stage status is acceptable. False maturity is not.

When a feature is planned but useful to discuss publicly, label it clearly as planned, experimental, beta, or in development.

### 2.5 Conversation has different tempos

Not every interaction belongs in the same feed.

HAI social/community products should support the right medium for the conversation when practical:

- **Chat:** immediate, synchronous or near-synchronous conversation.
- **Feed:** current activity, announcements, media, and lightweight interaction.
- **Forum / durable discussion:** slower, structured conversation that should remain understandable and referenceable over time.

Products should avoid forcing governance, policy, conflict resolution, or long-running knowledge into ephemeral channels when a durable medium is available.

### 2.6 Communities are made of relationships, not metrics

Community health should not be reduced to posting frequency, reaction volume, follower counts, or growth.

Useful measures may include:

- whether members can find one another;
- whether information remains discoverable;
- whether decisions can be understood later;
- whether new members can orient themselves;
- whether moderation is fair and explainable;
- whether people can leave without losing control of their own data.

### 2.7 Locality is a relationship, not only a coordinate

For place-based HAI products, belonging should reflect real human relationships to a place.

A person may belong because they:

- live there;
- live nearby;
- work there;
- visit often;
- attend school, worship, shop, volunteer, organize, or maintain family/community ties there.

Where residency verification is not legally or operationally necessary, avoid turning GPS coordinates into the definition of community membership.

> **If the place is part of your life, the place may be part of your network.**

### 2.8 Accessibility is part of correctness

A feature that cannot be used with common assistive technologies, keyboard navigation, or reasonable viewport sizes is incomplete.

Accessibility includes:

- semantic structure;
- keyboard operation;
- visible focus;
- screen-reader labeling and announcements;
- sufficient contrast;
- reduced-motion behavior;
- usable touch targets;
- meaningful error messaging;
- responsive layouts.

Accessibility failures in critical workflows can block a public release.

### 2.9 Failure must be understandable

Networks fail. Services time out. Uploads fail. Sessions expire.

Products should:

- preserve user work when practical;
- explain failures in human language;
- distinguish retryable failures from permanent ones;
- avoid silently discarding actions;
- recover from reconnects and expired sessions safely;
- provide useful empty/loading/error states.

A polished happy path does not compensate for destructive failure behavior.

### 2.10 Safety and moderation should be transparent and proportional

Community safety is necessary, but moderation systems can themselves become abusive.

Prefer:

- clear community rules;
- understandable reporting;
- auditable moderator actions where appropriate;
- proportionate restrictions;
- human review for severe or irreversible actions;
- appeals where the product's scale and risk justify them.

Automated moderation or reputation systems must not be marketed as implemented before they are operating and validated.

### 2.11 Shared infrastructure should feel coherent, not monolithic

HAI products may share identity, APIs, libraries, navigation, themes, and deployment infrastructure.

The user should experience this as convenience and coherence, not as an obligation to understand the monorepo.

- Shared login should reduce friction.
- Shared HAI navigation should make sibling products discoverable.
- Each product must still have a clear purpose and vocabulary.
- Cross-product promotion should be contextual rather than intrusive.
- Internal architecture terminology should not leak into customer-facing copy without a user benefit.

### 2.12 Prefer durable ownership over platform lock-in

Where technically and legally practical:

- use exportable formats;
- document data ownership;
- avoid unnecessary proprietary coupling;
- make migration possible;
- preserve stable identifiers and durable links;
- design toward interoperability.

A community should not disappear merely because a UI or company changes direction.

---

## 3. Product-family principles

### 3.1 Optimistic Tanuki (OT)

Core idea:

> **You are the social network.**

Optimistic Tanuki is organized around people, relationships, interests, and freely formed communities rather than geography.

The graph begins with the user and can extend through friends, peers, communities, and disconnected branches of their social life.

Communities are optional but encouraged. They provide shared spaces for people who talk, act, build, play, organize, or create together.

OT communities may be about nearly anything.

Place-based communities are allowed, but when locality is the defining characteristic, users should be encouraged to consider Towne Square.

#### OT visibility principle

- Private-community content remains private to that community.
- A public community may contain posts that are visible outside the community when the author explicitly chooses public visibility.
- Public visibility must never be inferred merely because the community itself is public.

Suggested plain-language rule:

> **Private means private. In public communities, a post reaches the wider network only when its author chooses to make it public.**

#### OT feed principle

- The user's primary feed should reflect chosen relationships and communities without engagement-maximizing reranking.
- Discovery, trends, suggested people, and suggested communities should remain a separate exploration surface.

#### OT discussion principle

Forums are first-class.

Communities should be able to use durable forum discussion in addition to feed posts and chat, especially for policy, governance, planning, disputes, and topics that benefit from slower participation.

### 3.2 Towne Square (TS)

Core idea:

> **Towne Square is organized around place.**

Towne Square exists for the places that are part of a person's life.

It should not become a generic social network.

Primary product themes include:

- local information;
- civic awareness;
- local communities;
- classifieds and nearby exchange;
- neighbor-to-neighbor messaging;
- practical local coordination.

Towne Square should lead with usefulness rather than ideology, while recognizing that making local public information understandable and participation easier is itself a civic goal.

#### TS locality principle

> **Live near. Visit often. If the town is part of your life, you belong in the conversation.**

#### TS acquisition principle

People do not need another generic social network. They do have recurring local questions.

Towne Square should earn attention by helping answer questions such as:

- What is happening nearby?
- What is my local government doing?
- What changed this week?
- What is for sale nearby?
- Who can help with this locally?
- What are people organizing around?

Community should emerge from usefulness.

### 3.3 OT and TS relationship

They are two halves of the same HAI community vision:

- **Optimistic Tanuki:** people and interests.
- **Towne Square:** place and local life.

Shared identity/login and the HAI application tag should make movement between them feel like changing context inside one broader ecosystem.

---

## 4. Release philosophy

A project does not need to be feature-complete to be public.

It does need to be honest, understandable, and safe enough for the audience being invited.

A public launch is acceptable when:

1. advertised functionality works;
2. private information stays within its promised boundary;
3. critical user journeys are tested;
4. errors do not routinely destroy user work;
5. the interface is usable on common mobile and desktop sizes;
6. critical workflows meet a reasonable accessibility baseline;
7. support, abuse reporting, and account lifecycle expectations are documented;
8. known limitations are described honestly;
9. no unresolved critical defect makes ordinary use unsafe or predictably broken.

> **Public-ready does not mean perfect. It means the product keeps the promises it makes.**

---

## 5. Agent and contributor rules

When working in this repository:

1. Treat this file as a normative product constraint.
2. If a requested implementation conflicts with it, identify the conflict.
3. Do not "improve" engagement by introducing dark patterns.
4. Do not add unverified marketing claims.
5. Do not silently broaden privacy or visibility.
6. Distinguish roadmap behavior from released behavior.
7. Prefer shared platform components when they satisfy the product need, while preserving each app's product identity.
8. When auditing, record evidence and uncertainty separately.
9. A code path existing is not proof that the user journey works.
10. Do not mark a release-readiness slice accepted without its stated acceptance evidence.

Project-specific ADRs may refine these rules but should not quietly weaken them.

---

## 6. Decision heuristic

When a design decision is ambiguous, ask:

1. Does this give the user more meaningful control?
2. Is the visibility/audience understandable?
3. Are we telling the truth about what exists?
4. Does this create real utility, or merely more engagement?
5. Will the information still be useful later?
6. Can a community understand and govern its own space?
7. Are we creating unnecessary dependence on HAI?
8. Would we be comfortable explaining this behavior plainly on the product's homepage?

If the answer to the final question is no, reconsider the design.
