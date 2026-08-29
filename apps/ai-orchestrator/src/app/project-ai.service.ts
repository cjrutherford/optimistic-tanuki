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
    /** Risks carry no title in project-planning; the description names them. */
    title?: string;
    description?: string;
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

/**
 * What the model is allowed to propose.
 *
 * One flat shape for every operation rather than a union of payload shapes.
 * A 7B model given six different field sets mixes them, and a proposal with
 * a task's fields under a risk's operation is not something a reviewer can
 * be shown. The mapping into real payloads happens here, in code, where the
 * shape is not a matter of the model's judgement.
 */
export const ProposedChangesSchema = z.object({
  proposals: z
    .array(
      z.object({
        operation: z
          .enum([
            'task.create',
            'task.update',
            'risk.create',
            'change.create',
            'projectJournal.create',
            'taskNote.create',
          ])
          .describe('What kind of thing to add'),
        title: z.string().describe('A short title or heading'),
        detail: z.string().describe('The body, description or mitigation'),
        status: z
          .enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED'])
          .optional()
          .describe('For task.create and task.update only'),
        priority: z
          .enum(['LOW', 'MEDIUM_LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'])
          .optional()
          .describe('For task.create and task.update only'),
        dueDate: z.string().optional().describe('For a task, as YYYY-MM-DD'),
        reason: z
          .string()
          .describe('Why this project needs it, from its own data'),
        relatesTo: z
          .string()
          .optional()
          .describe('The label of the task or risk this comes from, if any'),
      })
    )
    .describe('Changes worth making to this project'),
});

export type ProposedChange = {
  operation: string;
  payload: Record<string, unknown>;
  /** Shown to the reviewer, so the proposal argues for itself. */
  reason: string;
};

export interface ProposalResult {
  proposals: ProposedChange[];
  model: string | null;
  /** Proposals dropped because they could not be turned into a real change. */
  discarded: number;
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
   * Proposes changes to a project, for a person to accept or refuse.
   *
   * Nothing here writes anything. The result is a list of proposals the caller
   * files for approval, and the gate in project-planning is what decides
   * whether any of them ever becomes a row. This service produces an argument,
   * not a change.
   *
   * Same relabelling as the summary, and for the same reason: the model never
   * sees a real id, so a reference it invented resolves to nothing and the
   * proposal is dropped rather than filed against something that does not
   * exist.
   */
  async proposeChanges(
    project: SummarisableProject,
    today = new Date().toISOString().slice(0, 10)
  ): Promise<ProposalResult> {
    let config;
    try {
      config = this.models.getModelConfig(ModelType.TOOL_CALLING);
    } catch (error) {
      this.logger.warn(`Cannot propose: ${(error as Error).message}`);
      return {
        proposals: [],
        model: null,
        discarded: 0,
        unavailable: 'No model is configured for this.',
      };
    }

    try {
      const { view, toRealId, toTitle } = this.relabel(project);

      const model = this.models.getModel(ModelType.TOOL_CALLING);
      const raw = (await model
        .withStructuredOutput(ProposedChangesSchema, { name: 'proposals' })
        .invoke([
          new SystemMessage(this.proposalSystemPrompt()),
          new HumanMessage(this.proposalUserPrompt(view, today)),
        ])) as z.infer<typeof ProposedChangesSchema>;

      const { proposals, discarded } = this.toApplicablePayloads(
        raw.proposals ?? [],
        project.id,
        toRealId,
        toTitle
      );

      return { proposals, model: config.name, discarded };
    } catch (error) {
      this.logger.warn(
        `Proposals failed for project ${project.id}: ${
          (error as Error).message
        }`
      );
      return {
        proposals: [],
        model: config.name,
        discarded: 0,
        unavailable: 'Suggestions could not be generated just now.',
      };
    }
  }

  /**
   * Turns what the model wrote into payloads the executor can apply.
   *
   * A proposal that cannot be turned into a real change is dropped here rather
   * than filed. Putting it in front of a reviewer would be asking them to
   * approve something that fails the moment they do, and the failure would
   * look like theirs.
   */
  private toApplicablePayloads(
    written: z.infer<typeof ProposedChangesSchema>['proposals'],
    projectId: string,
    toRealId: Map<string, string>,
    toTitle: Map<string, string>
  ): { proposals: ProposedChange[]; discarded: number } {
    const proposals: ProposedChange[] = [];

    for (const item of written) {
      const title = this.namesInsteadOfLabels(item.title ?? '', toTitle);
      const detail = this.namesInsteadOfLabels(item.detail ?? '', toTitle);
      const reason = this.namesInsteadOfLabels(item.reason ?? '', toTitle);
      if (!title.trim()) continue;

      // A label the model invented maps to nothing, which is the whole point
      // of never showing it the real ids.
      const relatedId = item.relatesTo
        ? toRealId.get(item.relatesTo.trim())
        : undefined;

      switch (item.operation) {
        case 'task.create':
          proposals.push({
            operation: 'task.create',
            reason,
            payload: {
              projectId,
              title,
              description: detail,
              ...this.taskFields(item),
            },
          });
          break;
        case 'task.update':
          // An update needs something to update. Without a task named, there
          // is nothing to change, so it is dropped rather than guessed at.
          if (!relatedId || !item.relatesTo?.startsWith('t')) continue;
          proposals.push({
            operation: 'task.update',
            reason,
            payload: {
              projectId,
              id: relatedId,
              description: detail || title,
              // Without these an update could only ever rewrite a
              // description, which is not the change anybody wants offered.
              // Closing a task, raising its priority and moving a due date
              // are what a reviewer is waiting to be asked about.
              ...this.taskFields(item),
            },
          });
          break;
        case 'change.create':
          // A change record is one description, like a risk.
          proposals.push({
            operation: 'change.create',
            reason,
            payload: {
              projectId,
              changeDescription: detail ? `${title}. ${detail}` : title,
            },
          });
          break;
        case 'risk.create':
          // A risk is one description, not a title and a body. Splitting it
          // would put half the risk somewhere the service does not read.
          proposals.push({
            operation: 'risk.create',
            reason,
            payload: {
              projectId,
              description: detail ? `${title}. ${detail}` : title,
            },
          });
          break;
        case 'projectJournal.create':
          // A journal entry is content alone. There is no title column.
          proposals.push({
            operation: 'projectJournal.create',
            reason,
            payload: {
              projectId,
              content: detail ? `${title}\n\n${detail}` : title,
            },
          });
          break;
        case 'taskNote.create':
          // A note has to belong to a task. Without one there is nothing to
          // attach it to, so it is dropped rather than guessed at.
          if (!relatedId || !item.relatesTo?.startsWith('t')) continue;
          proposals.push({
            operation: 'taskNote.create',
            reason,
            payload: { projectId, taskId: relatedId, content: detail || title },
          });
          break;
      }
    }

    return { proposals, discarded: written.length - proposals.length };
  }

  /**
   * The task fields a proposal may carry, when the model set them.
   *
   * A due date is only taken when it reads as a date. Models write "next
   * week" and "TBD" in date fields, and a payload that fails validation on
   * approval is worse than one that says nothing.
   */
  private taskFields(item: {
    status?: string;
    priority?: string;
    dueDate?: string;
  }): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    if (item.status) fields.status = item.status;
    if (item.priority) fields.priority = item.priority;
    if (item.dueDate && /^\d{4}-\d{2}-\d{2}/.test(item.dueDate.trim())) {
      fields.dueDate = new Date(item.dueDate.trim()).toISOString();
    }
    return fields;
  }

  private proposalSystemPrompt(): string {
    return [
      'You are a project manager suggesting what a project is missing.',
      '',
      'Nothing you suggest happens on its own. A person reads each suggestion',
      'and decides. Write them so that decision is easy to make.',
      '',
      "Suggest only what this project's own data calls for. Do not invent",
      'people, dates or work that has nothing to do with what you were given.',
      '',
      'Use task.create for work that needs doing, task.update to change work',
      'that is already there, risk.create for something that could go wrong',
      'and is not recorded, change.create to record a change of scope or',
      'plan, projectJournal.create for a note about the project as a whole,',
      'and taskNote.create for a note on one task. task.update and',
      "taskNote.create must set relatesTo to that task's label.",
      '',
      'A task may carry a status, a priority and a due date. Set them when',
      'the project calls for it: closing work that is finished, raising the',
      'priority of what is urgent, dating what has none. Write a due date as',
      'YYYY-MM-DD and leave it out if you do not know one.',
      '',
      'Every suggestion carries a reason drawn from the data. "The board looks',
      'thin" is not a reason. "Nothing covers the inspection the permit',
      'requires" is.',
      '',
      'Two or three worth doing beat six that pad the board. If the project',
      'needs nothing, return none.',
      '',
      'Never write a label such as t1 or r2 inside title or detail. Name the',
      'task or risk by its title. Labels belong in relatesTo and nowhere else.',
    ].join('\n');
  }

  private proposalUserPrompt(
    project: SummarisableProject,
    today: string
  ): string {
    return [
      `Today is ${today}.`,
      '',
      'PROJECT',
      JSON.stringify(project, null, 2),
      '',
      'Suggest the changes this project needs. Each one names what to add and',
      'why this project needs it.',
    ].join('\n');
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
      // A risk has no title of its own. Reading one anyway put the string
      // "undefined" wherever the model cited a risk by its label.
      toTitle.set(label, risk.title ?? risk.description ?? label);
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
      'nobody is assigned to, an open risk with no mitigation, several high',
      // Dependencies were on this list and nothing records one. The only way
      // to satisfy that instruction was to infer a dependency and present it
      // as read from the data, and the grounding filter cannot catch it: a
      // made-up dependency can cite two perfectly real task ids.
      'priority tasks due at once. Restating a status is not a concern.',
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
