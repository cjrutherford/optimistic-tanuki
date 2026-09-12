import {
  APP_ACCESS_POLICIES,
  type AppAccessPolicy,
  type AppConfigRequestContext,
} from '@optimistic-tanuki/app-config-models';
import type { Logger } from '@nestjs/common';
import type { ConfigurationsService } from '../app/configurations.service';
import { demoAppConfigForScope } from './demo-config';

export async function seedDemoConfiguration(
  configurationsService: Pick<
    ConfigurationsService,
    'reconcileSeedConfiguration' | 'getAllConfigurations'
  > &
    Partial<
      Pick<ConfigurationsService, 'resolveContext' | 'publishConfiguration'>
    >,
  context: AppConfigRequestContext,
  logger: Pick<Logger, 'log'>
) {
  const demoAppConfig = demoAppConfigForScope(
    context.appScope,
    process.env.APP_CONFIG_SEED_BLOG_CATALOG_ID
  );
  const configuredName = process.env.APP_CONFIG_SEED_CONFIG_NAME?.trim();
  const configuredPolicy = process.env.APP_CONFIG_SEED_ACCESS_POLICY?.trim();
  const configuredDomain = process.env.APP_CONFIG_SEED_DOMAIN?.trim();
  const accessPolicy: AppAccessPolicy = APP_ACCESS_POLICIES.includes(
    configuredPolicy as AppAccessPolicy
  )
    ? (configuredPolicy as AppAccessPolicy)
    : 'public';
  const seededConfig = {
    ...demoAppConfig,
    ...(configuredName ? { name: configuredName } : {}),
    ...(configuredDomain ? { domain: configuredDomain } : {}),
    accessPolicy,
  };
  logger.log(
    `Creating or reconciling demo configuration: ${seededConfig.name} (${accessPolicy})...`
  );
  const created = await configurationsService.reconcileSeedConfiguration(
    seededConfig as any,
    context
  );
  const effectiveContext = configurationsService.resolveContext
    ? await configurationsService.resolveContext({
        ownerUserId: context.ownerUserId,
        ownerProfileId: context.ownerProfileId,
        appScope: context.appScope,
        workspaceId: context.workspaceId as string,
      })
    : {
        ...context,
        appInstanceId: created.appInstanceId ?? context.appInstanceId,
      };
  let published = created;
  const publishedSnapshot = created.release?.publishedSnapshot;
  const canonicalPublishedSnapshot = {
    name: seededConfig.name,
    description: seededConfig.description || '',
    domain: seededConfig.domain,
    landingPage: seededConfig.landingPage,
    routes: seededConfig.routes,
    features: seededConfig.features,
    theme: seededConfig.theme,
    manifest: seededConfig.manifest,
    accessPolicy,
    active: seededConfig.active,
  };
  const needsPublish =
    !publishedSnapshot ||
    !created.release?.publishedVersion ||
    created.release?.status !== 'published' ||
    JSON.stringify(publishedSnapshot) !==
      JSON.stringify(canonicalPublishedSnapshot);
  if (
    process.env.APP_CONFIG_SEED_PUBLISH === 'true' &&
    configurationsService.publishConfiguration &&
    needsPublish
  ) {
    published = await configurationsService.publishConfiguration(
      created.id,
      {
        expectedRevision: created.revision,
        releaseNotes: 'Seeded P11 access-policy fixture',
        changeSummary: `Seeded ${accessPolicy} discovery fixture`,
      },
      effectiveContext
    );
  }
  const configurations = await configurationsService.getAllConfigurations(
    effectiveContext
  );
  return { created: published, configurations };
}
