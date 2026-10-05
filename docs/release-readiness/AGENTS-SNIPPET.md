# Release-readiness agent guidance

The following guidance is installed in the repository `AGENTS.md`. Keep this copy synchronized when the canonical paths change.

```md
## Product and public-good philosophy

- Read [the HAI product philosophy](docs/product/HAI-PUBLIC-GOOD-PHILOSOPHY.md) before user-facing product, growth, privacy, feed/ranking, moderation, community, or marketing work. Treat it as normative.
- Any exception to the philosophy requires an explicit project ADR documenting its rationale, affected promises, and consequences before implementation.
- For Optimistic Tanuki and Towne Square release work, [the master audit](docs/release-readiness/MASTER-AUDIT.md) is the source of truth for RR slice scope, status, severity, and acceptance. Follow [the execution map](docs/release-readiness/EXECUTION-PLAN.md) and report findings at the end of each slice.
- Source presence and unit tests alone do not establish acceptance. Satisfy each slice's stated evidence, record checks not run, and synchronize its report with the master audit.
- Classify advertised claims as `VERIFY`, `COMPLETE`, `REWORD`, `RETRACT`, or `DEFER`. Implementation and validation for `COMPLETE` must fit one bounded slice; larger work stays in [the deferred register](docs/release-readiness/DEFERRED-FEATURES.md).
- RR-14 uses the operator-confirmed local `/home/cjrutherford/workspace/retumbl` checkout read-only. Record its reviewed SHA and working-tree state; connector access is not required. Do not copy secrets or private operational configuration.
```
