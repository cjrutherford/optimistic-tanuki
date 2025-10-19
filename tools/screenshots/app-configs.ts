export interface AppConfig {
  name: string;
  port: number;
  baseUrl: string;
  routes: RouteConfig[];
  serveCommand: string;
  buildRequired?: boolean;
}

export interface RouteConfig {
  path: string;
  name: string;
  requiresAuth?: boolean;
  waitForSelector?: string;
  beforeScreenshot?: (page: any) => Promise<void>;
}

export const angularApps: AppConfig[] = [
  {
    name: 'client-interface',
    port: 4200,
    baseUrl: 'http://localhost:4200',
    serveCommand: 'npx nx serve client-interface',
    routes: [
      {
        path: '/',
        name: 'landing',
        waitForSelector: 'body',
      },
      {
        path: '/login',
        name: 'login',
        waitForSelector: 'body',
      },
      {
        path: '/register',
        name: 'register',
        waitForSelector: 'body',
      },
      // These routes require authentication - we'll capture them without auth first
      {
        path: '/feed',
        name: 'feed',
        requiresAuth: true,
        waitForSelector: 'body',
      },
      {
        path: '/profile',
        name: 'profile',
        requiresAuth: true,
        waitForSelector: 'body',
      },
      {
        path: '/tasks',
        name: 'tasks',
        requiresAuth: true,
        waitForSelector: 'body',
      },
      {
        path: '/settings',
        name: 'settings',
        requiresAuth: true,
        waitForSelector: 'body',
      },
    ],
  },
  {
    name: 'forgeofwill',
    port: 4201,
    baseUrl: 'http://localhost:4201',
    serveCommand: 'npx nx serve forgeofwill --port=4201',
    routes: [
      {
        path: '/',
        name: 'projects',
        requiresAuth: true,
        waitForSelector: 'body',
      },
      {
        path: '/login',
        name: 'login',
        waitForSelector: 'body',
      },
      {
        path: '/register',
        name: 'register',
        waitForSelector: 'body',
      },
      {
        path: '/profile',
        name: 'profile',
        requiresAuth: true,
        waitForSelector: 'body',
      },
      {
        path: '/settings',
        name: 'settings',
        requiresAuth: true,
        waitForSelector: 'body',
      },
    ],
  },
  {
    name: 'christopherrutherford-net',
    port: 4202,
    baseUrl: 'http://localhost:4202',
    serveCommand: 'npx nx serve christopherrutherford-net --port=4202',
    routes: [
      {
        path: '/',
        name: 'landing',
        waitForSelector: 'body',
      },
    ],
  },
  {
    name: 'digital-homestead',
    port: 4203,
    baseUrl: 'http://localhost:4203',
    serveCommand: 'npx nx serve digital-homestead --port=4203',
    routes: [
      {
        path: '/',
        name: 'main-page',
        waitForSelector: 'body',
      },
      {
        path: '/blog',
        name: 'blog-page',
        waitForSelector: 'body',
      },
    ],
  },
];
