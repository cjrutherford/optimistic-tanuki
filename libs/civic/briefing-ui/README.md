# @optimistic-tanuki/civic-briefing-ui

Towne Square's briefing components, ported from the Daylight POC web app
(plan slice P4.2):

- `<civic-briefing-body [markdown]>`: a briefing's text, rendered.
- `<civic-edition-strip [route] [published] [end] [current]>`: the last four
  weeks of a town's editions, one mark per day, with gaps shown. `route` is
  the edition path without its date, such as `['/city', slug, 'briefing']`.
- `renderBriefing`, and the calendar-day helpers in `dates.ts`.

Briefings quote other people's headlines, so their text is never trusted.
`renderBriefing` escapes every raw HTML tag except the pipeline's
`<details>`/`<summary>`, keeps only http(s) links (opened in a new tab with
`rel="noopener noreferrer"`) and drops images. The component then binds the
result as a plain string, so Angular's sanitizer runs on the server and in
the browser. DOMPurify isn't used, because it needs jsdom on the server and
jsdom can't be bundled into SSR (owner decision, P4.2).

Colours come from the theme (`--primary`, `--foreground`,
`--foreground-muted`, `--on-primary`, `--border`).
