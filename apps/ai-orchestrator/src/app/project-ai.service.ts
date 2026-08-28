import { Injectable, Logger } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { ModelManager, ModelType } from './models/model-manager.service';

/**
 * Reads a project and says something about it.
 *
 * The shape is the one the slice A pilot validated: a headline, and concerns
 * that each cite the id of the task or risk they came from. The citation is
 * not decoration. It is what lets the caller check the model is talking about
 * this project rather than producing a plausible paragraph about projects in
 * general, which is the failure mode this whole feature was built to avoid.
 *
 * Nothing here is stored. The summary is derived from the project on every
 * request, so it cannot go stale, and there is no table to migrate.
 */

export const ProjectSummarySchema = z.object({
  headline: z.string().describe('One line on where the project stands'),
  concerns: z
    .array(
      z.object({
        about: z.string().describe('What the concern is'),
        why: z.string().describe('Why it matters, from the data'),
        evidenceId: z
          .string()
          .describe('The id of the task or risk this comes from'),
      })
    )
    .describe('Concerns a project manager should raise'),
});

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

/** Only what a summary needs. The service is not given the whole project. */
export interface SummarisableProject {
  id: string;
  name: string;
  description?: string;
  tasks?: {
    id: string;
    title: string;
    status?: string;
    priority?: string;
    assignee?: string | null;
    dueDate?: string | null;
  }[];
  risks?: {
    id: string;
    title: string;
    impact?: string;
    status?: string;
    mitigation?: string | null;
  }[];
}

export interface ProjectSummaryResult {
  summary: ProjectSummary | null;
  /** Which model wrote it, so the page can say. Null when nothing did. */
  model: string | null;
  /** Concerns dropped because they cited something that is not in the project. */
  discarded: number;
  /** Set when no summary could be produced. The caller shows the facts alone. */
  unavailable?: string;
}

@Injectable()
export class ProjectAiService {
  private readonly logger = new Logger(ProjectAiService.name);

  constructor(private readonly models: ModelManager) {}

  async summarise(
    project: SummarisableProject,
    today = new Date().toISOString().slice(0, 10)
  ): Promise<ProjectSummaryResult> {
    let config;
    try {
      config = this.models.getModelConfig(ModelType.PROJECT_ANALYSIS);
    } catch (error) {
      // No model configured for this job. Say so rather than falling back to
      // whatever else is around: a summary written by the conversational model
      // would be presented as if it came from the one that was chosen for this.
      this.logger.warn(`Cannot summarise: ${(error as Error).message}`);
      return {
        summary: null,
        model: null,
        discarded: 0,
        unavailable: 'No analysis model is configured.',
      };
    }

    try {
      const model = this.models.getModel(ModelType.PROJECT_ANALYSIS);
      const raw = (await model
        .withStructuredOutput(ProjectSummarySchema, { name: 'summary' })
        .invoke([
          new SystemMessage(this.systemPrompt()),
          new HumanMessage(this.userPrompt(project, today)),
        ])) as ProjectSummary;

      const { summary, discarded } = this.keepOnlyGrounded(raw, project);
      if (summary.concerns.length === 0 && discarded > 0) {
        // Every concern pointed at something that is not in this project. A
        // headline on its own is worth less than the facts the page already
        // has, so this counts as no summary rather than a thin one.
        return {
          summary: null,
          model: config.name,
          discarded,
          unavailable: 'The model did not refer to anything in this project.',
        };
      }

      return { summary, model: config.name, discarded };
    } catch (error) {
      this.logger.warn(
        `Summary failed for project ${project.id}: ${(error as Error).message}`
      );
      return {
        summary: null,
        model: config.name,
        discarded: 0,
        unavailable: 'The summary could not be generated just now.',
      };
    }
  }

  /**
   * Drops any concern citing an id this project does not contain.
   *
   * Models put several ids in one field, "t4,t5,t6" and "t3, r1" were both
   * seen during the pilot, and occasionally cite something that does not
   * exist. Neither is resolvable by anything downstream, and a concern nobody
   * can trace back is exactly what the citation requirement exists to prevent.
   */
  private keepOnlyGrounded(
    summary: ProjectSummary,
    project: SummarisableProject
  ): { summary: ProjectSummary; discarded: number } {
    const known = new Set([
      ...(project.tasks ?? []).map((task) => task.id),
      ...(project.risks ?? []).map((risk) => risk.id),
    ]);
    const concerns = summary.concerns.filter((concern) =>
      known.has(concern.evidenceId?.trim())
    );
    return {
      summary: { ...summary, concerns },
      discarded: summary.concerns.length - concerns.length,
    };
  }

  private systemPrompt(): string {
    return [
      'You are a project manager reading one project.',
      '',
      'The project is supplied in full below, so be specific about it. Refer',
      'to tasks and risks by their id.',
      '',
      'Say only what the data supports. Every concern must cite the id of the',
      'single task or risk it comes from. One id per concern, never a list.',
      'Do not invent tasks, people or dates that are not in the project.',
    ].join('\n');
  }

  private userPrompt(project: SummarisableProject, today: string): string {
    return [
      `Today is ${today}.`,
      '',
      'PROJECT',
      JSON.stringify(project, null, 2),
      '',
      'Write a short headline about where this project stands, then list the',
      'concerns a project manager should raise. Cite the id of the task or',
      'risk each concern comes from.',
    ].join('\n');
  }
}
