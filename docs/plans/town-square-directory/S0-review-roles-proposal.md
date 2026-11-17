# Proposed directory review and operating roles

Status: role responsibilities approved by the user on 2026-11-07. One person may hold multiple roles in a small deployment. Actual people, backups and access controls have not been assigned or tested; source use, spending and rollout remain separate decisions.

| Role | Responsibility | Decision or evidence |
| --- | --- | --- |
| Product owner | Define the intended deployment, accept scoped milestones and decide priorities, deferrals and the quality/rollout proposals. | Record the decision, scope and unresolved consequences in the slice register. |
| Source-use reviewer | Read the operation-by-operation source/field matrix, notices, boundary rights and known uncertainties; decide the proposed permitted uses or request changes. | Record the specific source release, operation, limitations and date. A product decision does not replace an actual license condition. |
| Privacy and quality reviewer | Review treatment of residential, sensitive and adult listings; agree the sample design and thresholds before sampling; examine quality findings and unresolved cases. | Residential and sensitive records stay blocked pending review; adult records require explicit opt-in. Record the approved protocol before real sampling. |
| Authorized directory operator | Use authenticated owner-console workflows to investigate and correct or withdraw records, with a named backup. | Record who acted, what changed, why and whether removal reached each relevant public/cache/export surface. Do not infer business ownership from provider identity. |
| Platform and Social owners | Keep the authoritative eligibility/privacy state, service identities, database/queue and access boundaries working; own incident response and coordinated recovery. | Demonstrate actual deployment permissions, census, alerting, fencing, backup and restore in S9. |
| Budget owner | Set provider enablement and review metering against the single $25/month budget across every provider and billed retry. | Verify conservative per-attempt reservations, reconciliation and effective stop controls; a budget is not a source-use approval. |

Before public launch, identify a primary and backup for correction requests and agree a practical response target and escalation when nobody is available. A user's report is a reason to investigate, not automatic proof that a business is closed or owned by the reporter. No role or review process in this proposal authorizes real source acquisition, export or public activation on its own.
