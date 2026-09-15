import express, { type Application, type RequestHandler } from 'express';
import { statSync } from 'node:fs';
import { isBrowserAssetRequest } from './browser-asset-guard';

export interface BrowserServerRoutingOptions {
  browserDistFolder: string;
  browserIndexPath: string;
  serverStartedAt: number;
  render: RequestHandler;
}

export function configureBrowserServerRoutes(
  app: Application,
  options: BrowserServerRoutingOptions
): void {
  app.use((req, res, next) => {
    if (
      isBrowserBuildStale(options.browserIndexPath, options.serverStartedAt)
    ) {
      res
        .status(503)
        .type('text/plain')
        .send('Learning server build is stale; restart the server.');
      return;
    }
    next();
  });

  app.use(
    express.static(options.browserDistFolder, {
      maxAge: '1y',
      index: false,
      redirect: false,
    })
  );

  app.use((req, res, next) => {
    if (isBrowserAssetRequest(req.path)) {
      res.status(404).type('text/plain').send('Browser asset not found.');
      return;
    }
    next();
  });

  app.use(options.render);

  app.use((req, res, next) => {
    if (isBrowserAssetRequest(req.path)) {
      res.status(404).type('text/plain').send('Browser asset not found.');
      return;
    }

    res.sendFile(options.browserIndexPath, (error) => {
      if (error) {
        next(error);
      }
    });
  });
}

export function isBrowserBuildStale(
  browserIndexPath: string,
  serverStartedAt: number
): boolean {
  try {
    return statSync(browserIndexPath).mtimeMs > serverStartedAt;
  } catch {
    return false;
  }
}
