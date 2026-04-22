# Learning Platform Architecture and Implementation Plan

## Scope

Build a multi-subject learning platform with choose-your-own-adventure progression, credit-bearing offerings (courses and projects), language variants, and synchronous/asynchronous evaluation (LLM + human).

## Domain Model

- **ProgramTrack**: top-level pathway with subjects, focuses, offerings, and requirement graph
- **Focus**: user-selected specialization in a track
- **Subject**: subject taxonomy with supported languages
- **Offering**: credit-bearing item (`course | project | milestone`) with level, credits, outcomes, modules, and activities
- **Module/Lesson**: instructional metadata and language variant references
- **Activity** (typed union):
  - `code.run`
  - `quiz.mcq`
  - `writing.response`
  - `project.submission`
- **Attempt**: learner submission state (`draft | submitted | graded | needs_revision`)
- **Evaluation**: grading result (`sync | async`, grader `auto | llm | human`, optional human override)
- **Rubric**: criterion-based scoring
- **CreditLedgerEntry**: awarded credits tied to evaluation results

## Requirement Graph Model

- Use **RequirementGroup** with:
  - `operator: AND | OR`
  - `minRequired` for N-of-M behavior
  - recursive `children` (group or offering node)
- Include:
  - prerequisite offering IDs per offering
  - unlock rules that evaluate requirement groups before an offering is available
- Foundation helper functions:
  - requirement satisfaction evaluation for completed offerings
  - unlock evaluation based on prerequisites + unlock rules
  - credit total calculation from completed offerings

## Language Variant Strategy

Support both:

1. **File variants** (preferred for concrete language examples)  
   Example metadata references:
   - `lesson-name.go.md`
   - `lesson-name.ts.md`
2. **Fenced blocks** in shared markdown where side-by-side language snippets are sufficient

Variant strategy is captured in lesson metadata (`strategy`, `sourcePath`, `languageId`).

## Evaluation Pipeline

1. Learner submits an **Attempt**.
2. If instant activity, optional synchronous auto-grade.
3. For async activities, run LLM rubric pre-grade (`grader: llm`, `mode: async`).
4. Human reviewer can confirm/override final grade (`humanOverride: true` when applicable).
5. Persist evaluation and award credits via credit ledger.

## Incremental Implementation Plan

### Milestone 1 (this PR foundation)

- Add architecture docs and planning artifacts.
- Add `learning-domain` shared library with:
  - schemas/types for core domain entities
  - requirement graph and unlock helpers
  - seed sample track data for two languages with N-of-M requirements
  - unit tests for credits, requirement satisfaction, unlock logic, and schema validation
- Add `learning-service` app with minimal REST contract:
  - `GET /learning/programs`
  - `POST /learning/attempts`
  - `POST /learning/evaluations`
  - thin persistence boundary via repository interface + in-memory implementation
  - unit tests for contract behavior

### Milestone 2 ✅

- Converted `learning-service` to TCP microservice transport (aligned with all other services).
- Added TypeORM entities (`ProgramTrackEntity`, `AttemptEntity`, `EvaluationEntity`, `CreditLedgerEntryEntity`).
- Added `config.ts`, `assets/config.yaml`, `loadDatabase.ts`, and `staticDatabase.ts` following repo conventions.
- Added initial TypeORM migration (`1770000000000-initial-schema`) for all learning tables.
- Replaced in-memory repository with `TypeOrmLearningRepository` backed by PostgreSQL.
- Added `LearningCommands` to shared constants library and `LEARNING_SERVICE` to ServiceTokens.
- Registered `learning-service` in `setup-and-migrate.sh` (database `ot_learning_service`) and `docker-compose.yaml` (port 3024).
- Added `LearningController` to gateway and LEARNING_SERVICE TCP client factory.
- Async evaluation workflow: attempts are created with `state: submitted`, evaluation grader field supports `auto | llm | human`, and `humanOverride` flag is preserved for reviewer override flow.

### Milestone 3

- Integrate with gateway and client applications.
- Add learner dashboard for requirement progress and credit ledger visibility.
- Implement evaluation queue for async review: LLM pre-grade worker, human reviewer UI, override flow with audit trail.
- Add credit ledger service operations: award credits after successful evaluation, query credit totals per user per track.
