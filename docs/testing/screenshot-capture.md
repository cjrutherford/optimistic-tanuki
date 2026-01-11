# Screenshot Capture Quick Start Guide

This workspace includes an automated screenshot capture tool for all Angular applications using Playwright.

## Quick Start

### Capture Screenshots for One App

```bash
cd tools/screenshots
./capture-single.sh client-interface 4200
```

Replace `client-interface` with any of:
- `client-interface` (port 4200)
- `forgeofwill` (port 4201)
- `christopherrutherford-net` (port 4202)
- `digital-homestead` (port 4203)

### Capture Screenshots for All Apps

```bash
cd tools/screenshots
./capture-all.sh
```

This will:
1. Start each Angular application
2. Capture screenshots of all routes
3. Generate a features breakdown report

### View Results

Screenshots are saved to `screenshots/[app-name]/`

A features breakdown report is generated at `FEATURES_BREAKDOWN.md`

## Prerequisites

First time setup:

```bash
# Install dependencies
npm install

# Install Playwright Chrome browser
npx playwright install chromium
```

## More Information

See detailed documentation in [tools/screenshots/README.md](tools/screenshots/README.md)
