import 'reflect-metadata';
import { Type } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../auth/auth.guard';
import { IdentityThrottlerGuard } from '../controllers/learning/identity-throttler.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import {
  DirectoryController,
  DirectoryOwnerScopeGuard,
} from '../controllers/directory/directory.controller';
import { DirectoryAddressReviewController } from '../controllers/directory/directory-address-review.controller';
import { DirectoryBusinessIdentityReviewController } from '../controllers/directory/directory-business-identity-review.controller';
import {
  DirectoryBusinessLinkController,
  DirectoryBusinessLinkQueueController,
} from '../controllers/directory/directory-business-link.controller';
import { DirectoryExportsController } from '../controllers/directory/directory-exports.controller';
import {
  DirectoryListingReportController,
  DirectoryListingReportReviewController,
} from '../controllers/directory/directory-listing-report.controller';
import { DirectoryListingSuppressionController } from '../controllers/directory/directory-listing-suppression.controller';
import { DirectoryOperationsController } from '../controllers/directory/directory-operations.controller';
import { DirectoryPublicExportController } from '../controllers/directory/directory-public-export.controller';
import {
  DirectoryRightsCasesController,
  DirectoryWithdrawalsController,
} from '../controllers/directory/directory-rights.controller';
import { DirectoryRunsController } from '../controllers/directory/directory-runs.controller';
import { DirectoryTaxonomyController } from '../controllers/directory/directory-taxonomy.controller';

/** Every Directory controller the gateway mounts. Keep in step with app.module. */
export const DIRECTORY_CONTROLLERS: Type<unknown>[] = [
  DirectoryController,
  DirectoryPublicExportController,
  DirectoryRunsController,
  DirectoryRightsCasesController,
  DirectoryWithdrawalsController,
  DirectoryTaxonomyController,
  DirectoryExportsController,
  DirectoryOperationsController,
  DirectoryAddressReviewController,
  DirectoryBusinessIdentityReviewController,
  DirectoryBusinessLinkController,
  DirectoryBusinessLinkQueueController,
  DirectoryListingReportController,
  DirectoryListingReportReviewController,
  DirectoryListingSuppressionController,
];

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface OperationFacts {
  tag: string;
  public: boolean;
  guarded: boolean;
  ownerConsole: boolean;
  permissions: string[];
}

function guardsOf(target: object): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[]) ?? [];
}

/** Reads, per `Controller_method` operationId, what the route decorators say. */
function collectFacts(): Map<string, OperationFacts> {
  const facts = new Map<string, OperationFacts>();
  for (const ctrl of DIRECTORY_CONTROLLERS) {
    const classGuards = guardsOf(ctrl);
    const proto = ctrl.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      const handler = proto[name];
      if (typeof handler !== 'function') continue;
      if (Reflect.getMetadata('path', handler) === undefined) continue;
      const guards = [...classGuards, ...guardsOf(handler)];
      const isPublic =
        Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true ||
        Reflect.getMetadata(IS_PUBLIC_KEY, ctrl) === true;
      const perm = (Reflect.getMetadata(PERMISSIONS_KEY, handler) ?? {}) as {
        permissions?: string[];
      };
      facts.set(`${ctrl.name}_${name}`, {
        tag: ctrl.name.replace(/Controller$/, ''),
        public: isPublic,
        guarded: guards.includes(AuthGuard),
        ownerConsole: guards.includes(DirectoryOwnerScopeGuard),
        permissions: perm.permissions ?? [],
      });
    }
  }
  return facts;
}

interface OpenApiOperation {
  operationId?: string;
  tags?: string[];
  parameters?: { in: string; required?: boolean }[];
  security?: Record<string, string[]>[];
  description?: string;
  [extension: `x-${string}`]: unknown;
}
interface OpenApiDocument {
  paths: Record<string, Record<string, OpenApiOperation>>;
  [key: string]: unknown;
}

/**
 * Builds the Directory OpenAPI document from the real controllers on a
 * minimal module: guards and the microservice clients are stubbed, nothing
 * connects. The global `api` prefix matches the served gateway.
 */
export async function buildDirectoryOpenApi(): Promise<OpenApiDocument> {
  const stubClient = { send: () => undefined, emit: () => undefined };
  const moduleRef = await Test.createTestingModule({
    controllers: DIRECTORY_CONTROLLERS,
    providers: [
      { provide: ServiceTokens.SOCIAL_SERVICE, useValue: stubClient },
      { provide: ServiceTokens.PAYMENTS_SERVICE, useValue: stubClient },
    ],
  })
    .overrideGuard(AuthGuard)
    .useValue({})
    .overrideGuard(PermissionsGuard)
    .useValue({})
    .overrideGuard(IdentityThrottlerGuard)
    .useValue({})
    .overrideGuard(DirectoryOwnerScopeGuard)
    .useValue({})
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  await app.init();

  const config = new DocumentBuilder()
    .setTitle('Optimistic Tanuki Directory API')
    .setDescription(
      'Directory endpoints exposed by the gateway. Public routes need no ' +
        'credentials; every other route needs a bearer session and the ' +
        'permission named in x-required-permissions. Routes marked ' +
        'x-app-scope additionally require the X-OT-AppScope header.'
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    // Deterministic, collision-free ids that match collectFacts().
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey}_${methodKey}`,
  }) as unknown as OpenApiDocument;
  await app.close();

  const facts = collectFacts();
  const tags = new Set<string>();
  for (const item of Object.values(document.paths)) {
    for (const m of HTTP_METHODS) {
      const op = item[m];
      if (!op) continue;
      const f = op.operationId ? facts.get(op.operationId) : undefined;
      if (!f) continue;
      op.tags = [f.tag];
      // Query handlers read optional values untyped; swagger infers required.
      for (const prm of op.parameters ?? [])
        if (prm.in === 'query') prm.required = false;
      tags.add(f.tag);
      if (f.public || !f.guarded) {
        op.security = [];
        op['x-public'] = true;
      } else {
        op.security = [{ bearer: [] }];
        op['x-public'] = false;
      }
      if (f.permissions.length) op['x-required-permissions'] = f.permissions;
      if (f.ownerConsole) op['x-app-scope'] = 'owner-console';
    }
  }
  document['tags'] = [...tags].sort().map((name) => ({ name }));
  return sortKeys(document) as OpenApiDocument;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)])
    );
  }
  return value;
}

export function serializeDirectoryOpenApi(doc: unknown): string {
  return JSON.stringify(doc, null, 2) + '\n';
}
