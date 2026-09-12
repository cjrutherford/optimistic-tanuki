import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BlogCatalogCommands } from '@optimistic-tanuki/constants';
import type {
  AppConfigRequestContext,
  AppConfigurationSnapshot,
} from '@optimistic-tanuki/app-config-models';
import { resolveBlogCatalogReference } from '@optimistic-tanuki/configurable-plugin-contracts';
import { firstValueFrom } from 'rxjs';

export async function validatePublishedManifestResources(
  snapshot: Pick<AppConfigurationSnapshot, 'manifest'> | undefined,
  context: AppConfigRequestContext,
  bloggingClient: ClientProxy
): Promise<void> {
  const bloggingCapability =
    snapshot?.manifest?.capabilities?.['blogging.posts'];
  if (!bloggingCapability?.enabled) return;

  const catalogId = resolveBlogCatalogReference(
    bloggingCapability.resourceRef ?? { type: '', id: '' }
  );
  if (!catalogId) {
    throw new ForbiddenException(
      'Published Blogging requires a valid blog-catalog resource reference'
    );
  }

  let catalogs: unknown;
  try {
    catalogs = await firstValueFrom(
      bloggingClient.send(
        { cmd: BlogCatalogCommands.FIND_ALL },
        {
          ownerId: context.ownerProfileId,
          workspaceId: context.workspaceId,
          appScope: context.appScope,
        }
      )
    );
  } catch {
    throw new ServiceUnavailableException(
      'Published Blogging resource validation is unavailable'
    );
  }

  const ownsCatalog =
    Array.isArray(catalogs) &&
    catalogs.some(
      (catalog) =>
        catalog &&
        typeof catalog === 'object' &&
        (catalog as { id?: unknown }).id === catalogId
    );
  if (!ownsCatalog) {
    throw new ForbiddenException(
      'The published Blogging catalog is not owned by this app context'
    );
  }
}
