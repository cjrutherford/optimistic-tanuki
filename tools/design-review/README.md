# Personality design review

Renders the same Storybook stories under all 12 personalities and builds a
self-contained HTML review: one grid per story, a measured style comparison
between personalities, and the written critique.

Use it after changing theme-models, theme-lib, theme-styles or the shared UI
libraries, to check that personalities still look distinct from each other.

## Requirements

- A built playground: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx build ui-playground`
- `agent-browser`, system Google Chrome, Python 3 with Pillow, Node

## Run

```bash
# 1. Serve the built Storybook
(cd dist/apps/ui-playground/browser && python3 -m http.server 4310 --bind 127.0.0.1) &

# 2. Capture (light: 15 stories, dark: 6), one worker per mode
export DESIGN_REVIEW_OUT=/tmp/persona-eval
tools/design-review/capture.sh light 9351 <story ids...> &
tools/design-review/capture.sh dark 9352 <story ids...> &
wait

# 3. Grids and style comparison
python3 tools/design-review/sheets.py
node tools/design-review/distinct.js

# 4. Report (reads $DESIGN_REVIEW_OUT/report.json)
python3 tools/design-review/build_report.py
```

`STORYBOOK_URL` overrides the Storybook origin (default `http://127.0.0.1:4310`).

Chrome is started with `--no-sandbox` and attached over CDP because
agent-browser's own launch fails on hosts where AppArmor blocks user
namespaces.

## Outputs

- `$DESIGN_REVIEW_OUT/{light,dark}/<story>--<personality>.png`: raw captures
- `sheet-<mode>-<story>.png`: 4×3 personality grid per story
- `signatures-<mode>.jsonl`: computed button, input and label styles per personality
- `personality-design-review.html`: the review, with every image embedded

`report.json` holds the written critique (summary, verdicts, sections, plan);
see the docstring in `build_report.py` for its shape.
