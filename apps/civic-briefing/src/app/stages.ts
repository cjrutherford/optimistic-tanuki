import type { INestApplicationContext } from '@nestjs/common';
import type { PipelineStages } from '@optimistic-tanuki/civic-core';
import { AgendaService } from './agenda/agenda.service';
import { BriefingService } from './briefing/briefing.service';
import { CollateService } from './collate/collate.service';
import { GatherService } from './gather/gather.service';
import { ParseService } from './parse/parse.service';
import { ProjectionService } from './projection/projection.service';

/**
 * The ported stages, in the shapes the runner calls. One definition for the
 * replay that proves them and the daily run that uses them, so what the
 * golden harness checks is what the schedule runs.
 */
export function portedStages(app: INestApplicationContext): PipelineStages {
  const gather = app.get(GatherService);
  const parse = app.get(ParseService);
  const agenda = app.get(AgendaService);
  const projection = app.get(ProjectionService);
  const collate = app.get(CollateService);
  const briefing = app.get(BriefingService);
  return {
    gather: (_ds, locality, options) => gather.gather({ locality, ...options }),
    parseAll: (_ds, locality, options) => parse.parse({ locality, ...options }),
    extractAgenda: (_ds, locality, fixup, contextRange, timezone, runId) =>
      agenda.extract({ locality, fixup, contextRange, timezone, runId }),
    projectItems: (_ds, targetSlug, registryArgument, _attempt, options) =>
      projection.project({
        targetSlug,
        registry: registryArgument,
        contextRange: options?.contextRange,
      }),
    collate: (
      _ds,
      localitySlug,
      since,
      publishedSince,
      ruleVersion,
      timezone,
      publishedEnd,
      contextEnd
    ) =>
      collate.collate({
        localitySlug,
        since,
        publishedSince,
        ruleVersion,
        timezone,
        publishedEnd,
        contextEnd,
      }),
    brief: (_ds, ...rest) => briefing.brief(...rest),
  } as PipelineStages;
}
