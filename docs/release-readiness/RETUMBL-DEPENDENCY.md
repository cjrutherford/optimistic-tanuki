# `retumbl` Prototype Evaluation Dependency

## Repository

Private repository:

`https://github.com/cjrutherford/retumbl`

## Expected access model

The operator confirmed the current local checkout at `/home/cjrutherford/workspace/retumbl` on 2026-10-05. Mapping HEAD: `9f2c1cc76cad41208cdbe8104682d2bc0c196491`. The initially supplied `rebumbl` path was corrected to `retumbl`. Record the actual reviewed SHA and working-tree state when RR-14 begins.

Do **not** assume the GitHub connector can access it.

When RR-14 begins:

1. Resolve the local checkout path.
2. Record the exact commit SHA.
3. Inspect architecture, data model, tests, trust/reputation logic, and federation-related code.
4. Do not modify the private repository unless explicitly instructed.
5. Do not import secrets/configuration/private operational data.
6. Treat the repository as an experimental source of reusable ideas/code.
7. Produce a `reuse / adapt / rewrite / reject` matrix.
8. Re-estimate DF-001 based on the actual implementation.
9. Feed federation-relevant findings into RR-15.

## Primary questions

- What is being scored: users, content, moderators, relationships, servers, or contexts?
- Is reputation global or contextual?
- What events change reputation?
- Is scoring explainable?
- Can it be appealed or overridden?
- Is there an audit log?
- How resistant is it to Sybil attacks, brigading, collusion, and retaliation?
- Does it make automated enforcement decisions or only recommendations?
- How does it interact with federation?
- Could a community opt out or define local policy?
