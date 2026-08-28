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
      // The model never sees a real id. Tasks and risks are relabelled t1, r1
      // and so on for the call, and the labels are mapped back afterwards.
      //
      // Two reasons. Models inline the id they are citing into their prose, so
      // a real project put "Task 0e5d1f75-c0b8-4830-b98f-185cbc88ee4c (strip
      // the old liner)" on the page. And the pilot that chose this model
      // measured it on short labels, so sending it something else is not what
      // was validated.
      const { view, toRealId, toTitle } = this.relabel(project);

      const model = this.models.getModel(ModelType.PROJECT_ANALYSIS);
      const raw = (await model
        .withStructuredOutput(ProjectSummarySchema, { name: 'summary' })
        .invoke([
          new SystemMessage(this.systemPrompt()),
          new HumanMessage(this.userPrompt(view, today)),
        ])) as ProjectSummary;

      const { summary, discarded } = this.keepOnlyGrounded(raw, toRealId);
      summary.headline = this.namesInsteadOfLabels(summary.headline, toTitle);
      summary.concerns = summary.concerns.map((concern) => ({
        ...concern,
        about: this.namesInsteadOfLabels(concern.about, toTitle),
        why: this.namesInsteadOfLabels(concern.why, toTitle),
      }));
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
   * Gives everything a short label for the duration of one call.
   *
   * Returns the project as the model should see it, plus the map back. The map
   * is the only thing that can turn a cited label into a real id, so a label
   * the model invented resolves to nothing and the concern is dropped.
   */
  private relabel(project: SummarisableProject): {
    view: SummarisableProject;
    toRealId: Map<string, string>;
    toTitle: Map<string, string>;
  } {
    const toRealId = new Map<string, string>();
    const toTitle = new Map<string, string>();
    const tasks = (project.tasks ?? []).map((task, index) => {
      const label = `t${index + 1}`;
      toRealId.set(label, task.id);
      toTitle.set(label, task.title);
      return { ...task, id: label };
    });
    const risks = (project.risks ?? []).map((risk, index) => {
      const label = `r${index + 1}`;
      toRealId.set(label, risk.id);
      toTitle.set(label, risk.title);
      return { ...risk, id: label };
    });
    return {
      view: { ...project, id: 'this-project', tasks, risks },
      toRealId,
      toTitle,
    };
  }

  /**
   * Puts titles back where the model wrote a label.
   *
   * Asking it not to write ids in the prose did not work. Told plainly, twice,
   * it still returned "Task t2" and "Tasks t3 and possibly t2". A 7B model is
   * not reliable enough at that kind of instruction to leave it to chance, and
   * a reader seeing "t2" is no better off than one seeing a UUID.
   *
   * So the substitution is done here, where it cannot fail. Longer labels are
   * replaced first so t10 is not mangled by the rule for t1.
   */
  private namesInsteadOfLabels(
    text: string,
    toTitle: Map<string, string>
  ): string {
    const labels = [...toTitle.keys()].sort((a, b) => b.length - a.length);
    return (
      labels
        .reduce(
          (prose, label) =>
            prose.replace(
              // The prefix takes its own space with it. An unconditional
              // \\s* swallowed the space before a bare label, turning
              // "and t2" into "andBook crane".
              new RegExp(`\\b(?:(?:task|risk)s?\\s+)?${label}\\b`, 'gi'),
              toTitle.get(label) as string
            ),
          text
        )
        // The model writes "Task t2 (Book the crane)", naming the thing twice
        // once the label becomes a title. Collapse the repeat rather than put
        // "Book the crane (Book the crane)" in front of a reader.
        .replace(/['"]?([^()'"]+?)['"]?\s*\(\s*['"]?\1['"]?\s*\)/gi, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim()
    );
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
    toRealId: Map<string, string>
  ): { summary: ProjectSummary; discarded: number } {
    const concerns = summary.concerns
      .map((concern) => {
        const realId = toRealId.get(concern.evidenceId?.trim());
        return realId ? { ...concern, evidenceId: realId } : null;
      })
      .filter((concern): concern is NonNullable<typeof concern> => !!concern);
    return {
      summary: { ...summary, concerns },
      discarded: summary.concerns.length - concerns.length,
    };
  }

  private systemPrompt(): string {
    return [
      'You are a project manager reading one project.',
      '',
      'Say only what the data supports. Do not invent tasks, people or dates',
      'that are not in the project.',
      '',
      'Every concern carries exactly one id in the evidenceId field. One id,',
      'never a list, never several joined by commas.',
      '',
      // Observed on a real project: the model wrote "Task
      // 0e5d1f75-c0b8-4830-b98f-185cbc88ee4c (strip the old liner) was due..."
      // The id belongs in evidenceId, which the page resolves to a title. In
      // the prose it is noise the reader has to look past.
      'Never write an id inside about or why. Name the task or risk by its',
      'title instead. The id goes in evidenceId and nowhere else.',
      '',
      // "Marked TODO but not started" is true of every TODO task and told the
      // reader nothing they could not see in the status column.
      'Raise a concern only where the data shows something a reader would not',
      'get from glancing at the board. Work that is past its due date, work',
      'nobody is assigned to, an open risk with no mitigation, a dependency',
      'that will not be met in time. Restating a status is not a concern.',
      '',
      'Two or three real concerns are better than five padded ones. If',
      'nothing is genuinely wrong, say so in the headline and return no',
      'concerns.',
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
