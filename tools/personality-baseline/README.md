# personality-baseline

Pixel baseline for the personality/motion migration. Plain Node ESM, uses Playwright chromium.

```
node capture.mjs --storybook <static-storybook-dir> --out <dir> [--story <id>] [--only <personalityId>]
node compare.mjs <dirA> <dirB> --report <report.html>
```

Build the static storybook with
`nx build-storybook common-ui --outputDir=<dir>` (use the Nx env from CLAUDE.md).

capture.mjs writes `stills/` (every predefined personality x light/dark x primaries #3f51b5, #d97706,
#0d9488, via the `primaryColor` global), `focus/` (Tab through the
first 12 focusables, element box + 8px), and `motion/` (3s webm per personality, light). Personality ids
are read from the built storybook's globals; focus shots and clips use #3f51b5. It fails if a Google Fonts stylesheet is not 200 or any font face errors.

compare.mjs does an exact RGBA comparison (pngjs) and reports identical/changed/missing per group.
Captures are not committed; keep them under /tmp or `out/` (gitignored).
