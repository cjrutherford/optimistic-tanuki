# Angular Applications Screenshot Capture Tool

This tool uses Playwright to automatically capture screenshots of all Angular applications in the workspace. It captures screenshots of every route in each application across multiple viewport sizes (desktop, tablet, mobile).

## Overview

The screenshot capture tool:
- Uses Playwright with Chrome browser only (as specified)
- Captures full-page screenshots of each route
- Supports multiple viewport sizes (desktop, tablet, mobile)
- Organizes screenshots by application and viewport
- Can capture all apps at once or individual apps

## Applications Covered

The tool captures screenshots from these Angular applications:

1. **client-interface** (port 4200)
   - Landing page
   - Login page
   - Register page
   - Feed (requires auth)
   - Profile (requires auth)
   - Tasks (requires auth)
   - Settings (requires auth)

2. **forgeofwill** (port 4201)
   - Projects page (requires auth)
   - Login page
   - Register page
   - Profile (requires auth)
   - Settings (requires auth)

3. **christopherrutherford-net** (port 4202)
   - Landing page

4. **digital-homestead** (port 4203)
   - Main page
   - Blog page

## Prerequisites

1. Install dependencies (from the root of the workspace):
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```
   
   **Note**: If the Playwright browser download fails, you can try:
   - Using a different mirror: `PLAYWRIGHT_DOWNLOAD_HOST=https://mirrors.huaweicloud.com/playwright npx playwright install chromium`
   - Clearing the cache: `rm -rf ~/.cache/ms-playwright && npx playwright install chromium`
   - Installing all browsers: `npx playwright install`

## Usage

### Option 1: Capture Screenshots for a Single App

The easiest way to capture screenshots is to use the single app script:

```bash
cd tools/screenshots
./capture-single.sh <app-name> [port]
```

Examples:
```bash
./capture-single.sh client-interface 4200
./capture-single.sh forgeofwill 4201
./capture-single.sh christopherrutherford-net 4202
./capture-single.sh digital-homestead 4203
```

### Option 2: Capture Screenshots for All Apps

To capture screenshots of all applications at once:

```bash
cd tools/screenshots
./capture-all.sh
```

This script will:
1. Start each Angular application one at a time
2. Wait for the application to be ready
3. Capture screenshots of all routes
4. Stop the application and move to the next one

### Option 3: Manual Capture with Running App

If you already have an application running, you can capture screenshots directly:

```bash
# In one terminal, start the app
npx nx serve client-interface --port=4200

# In another terminal, run the screenshot tests
cd tools/screenshots
BASE_URL="http://localhost:4200" APP_NAME="client-interface" npx playwright test --grep="client-interface" --config=playwright.config.ts
```

### Viewing Results

Screenshots are saved in the `screenshots/` directory at the root of the workspace:

```
screenshots/
├── client-interface/
│   ├── landing-desktop.png
│   ├── landing-tablet.png
│   ├── landing-mobile.png
│   ├── login-desktop.png
│   └── ...
├── forgeofwill/
│   └── ...
├── christopherrutherford-net/
│   └── ...
└── digital-homestead/
    └── ...
```

To view the Playwright HTML report:
```bash
cd tools/screenshots
npm run report
```

## Configuration

### Adding New Routes

To add new routes to capture, edit `app-configs.ts`:

```typescript
{
  name: 'client-interface',
  port: 4200,
  baseUrl: 'http://localhost:4200',
  serveCommand: 'npx nx serve client-interface',
  routes: [
    {
      path: '/new-route',
      name: 'new-route',
      waitForSelector: 'body', // Optional: wait for specific element
      requiresAuth: false,
    },
    // ... more routes
  ],
}
```

### Customizing Viewports

To add or modify viewports, edit the `viewports` array in `tests/capture-screenshots.spec.ts`:

```typescript
const viewports = [
  { width: 1920, height: 1080, name: 'desktop' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 375, height: 667, name: 'mobile' },
  // Add more viewports here
];
```

### Handling Authentication

Routes that require authentication will currently capture the redirect or login page. To capture authenticated screens:

1. Modify the `beforeScreenshot` function in the route config to perform login
2. Or use Playwright's storage state feature to save authentication state

Example:
```typescript
{
  path: '/feed',
  name: 'feed',
  requiresAuth: true,
  beforeScreenshot: async (page) => {
    // Add authentication logic here
    await page.evaluate(() => {
      localStorage.setItem('token', 'your-test-token');
    });
  },
}
```

## Troubleshooting

### Port Already in Use

If you get an error about a port being in use:
```bash
# Find and kill the process using the port
lsof -ti:4200 | xargs kill -9
```

### Playwright Browser Not Installed

```bash
npx playwright install chromium
```

### Screenshots Look Incomplete

- Increase the `waitForTimeout` in `capture-screenshots.spec.ts`
- Add specific `waitForSelector` to wait for key elements to load
- Check the Playwright report for errors: `npm run report`

### Server Fails to Start

Check the server logs:
```bash
cat /tmp/<app-name>-serve.log
```

## Features Breakdown Generation

After capturing screenshots, you can generate a features breakdown report:

```bash
cd tools/screenshots
./generate-features-report.sh
```

This will create a `FEATURES_BREAKDOWN.md` file at the root of the workspace that includes:
- List of all applications analyzed
- All screens/routes captured for each application
- Responsive viewport coverage (desktop, tablet, mobile)
- Total statistics
- Links to screenshot locations

The report provides a comprehensive overview of the features implemented in each Angular application based on the captured screenshots.

### Manual Feature Analysis

The screenshots can also be manually analyzed to generate a more detailed features breakdown by:

1. Reviewing each screenshot to identify UI components and features
2. Documenting the routes and their functionality
3. Creating a feature matrix based on visual inspection

For automated feature detection, consider:
- Using OCR to extract text from screenshots
- Analyzing DOM structure at screenshot time
- Using AI vision models to identify UI components

## CI/CD Integration

To integrate into CI/CD pipelines:

```bash
# Install dependencies
npm install
npx playwright install chromium

# Build all applications
npm run build

# Capture screenshots
cd tools/screenshots
./capture-all.sh

# Archive screenshots as artifacts
tar -czf screenshots.tar.gz ../../screenshots/
```

## Notes

- Only Chrome browser is used as specified in requirements
- Screenshots capture the full page (scrollable content)
- Each app is tested independently to avoid port conflicts
- The tool is designed to be extended with additional apps and routes
