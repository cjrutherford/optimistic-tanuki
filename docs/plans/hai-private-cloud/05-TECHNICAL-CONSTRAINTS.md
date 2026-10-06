# Technical Constraints

- Reuse the current framework and project conventions.
- Reuse current design tokens and component patterns.
- Do not introduce a new CSS framework for this project.
- Prefer reusable components over repeated page-local implementations.
- Do not modify unrelated backend systems.
- Do not introduce Kubernetes or unrelated infrastructure into this marketing-site effort.
- Avoid new dependencies unless justified by the slice.
- Use responsive images and modern image formats where the existing stack supports them.
- Prefer SVG for icons and logos.
- Existing tests must remain green.
- Existing routes must remain functional.
- Preserve existing dark/light theme behavior if both modes exist.

## Quality bar

A slice is not complete until:

- relevant tests pass,
- build succeeds,
- lint/typecheck pass where applicable,
- acceptance criteria are checked,
- completion notes are written.
