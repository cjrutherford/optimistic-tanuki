import { Injectable, Logger } from '@nestjs/common';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';
import { ModelManager, ModelType } from './models/model-manager.service';
import { McpSession, ToolsService } from './tools.service';

/**
 * An agent that does the work, through the same tools a person's client would
 * use, as the person who asked.
 *
 * Everything else in this service reads a project and says something about it.
 * This one acts. It reaches the gateway's MCP server over an authenticated
 * session, so the gate decides what happens: on a project that requires
 * approval the tools file a proposal and tell the agent plainly that nothing
 * was done, and the agent reports that rather than claiming success.
 *
 * The agent is never told about the gate. It calls create_task and is told
 * what happened. Teaching it to reason about approval would make the gate a
 * matter of the model's judgement, and the point of a gate is that it is not.
 */

/**
 * Whether any tool answered that a person still has to decide.
 *
 * Read from what the tools returned rather than from what the model said. A
 * model reporting "I created the task" over a proposal nobody has looked at is
 * the failure the gate exists to prevent, and its own words are the one source
 * that cannot be trusted to reveal it.
 */
export function saysAwaitingApproval(
  used: { tool: string; result: string }[]
): boolean {
  return used.some((call) => /waiting for approval/i.test(call.result));
}

/** One exchange, as the caller keeps it between requests. */
export interface AgentTurn {
  role: 'person' | 'assistant';
  text: string;
}

/**
 * The thread so far, as messages the model can read.
 *
 * Without this every instruction started cold, so "now assign it to me" had
 * nothing to attach to and the assistant asked what "it" was. Only the most
 * recent turns are carried, because the model re-reads all of them on every
 * request and a thread left to grow eventually costs more than it helps.
 */
export function rememberedTurns(history: AgentTurn[], limit: number) {
  return history
    .slice(-limit)
    .map((turn) =>
      turn.role === 'person'
        ? new HumanMessage(turn.text)
        : new AIMessage(turn.text)
    );
}

export interface AgentRunResult {
  /** What the agent said it did, in its own words. */
  said: string;
  /** Tools it actually called, so the caller can check the words against them. */
  used: { tool: string; result: string }[];
  /** True when at least one call came back waiting for a person. */
  awaitingApproval: boolean;
  model: string | null;
  unavailable?: string;
}

@Injectable()
export class ProjectAgentService {
  private readonly logger = new Logger(ProjectAgentService.name);

  constructor(
    private readonly models: ModelManager,
    private readonly tools: ToolsService
  ) {}

  /**
   * How much of the thread is carried back in.
   *
   * Enough for the assistant to follow a conversation, bounded because every
   * turn is re-read by the model on every request and a thread left to grow
   * eventually costs more than it helps.
   */
  static readonly TURNS_REMEMBERED = 12;

  async act(
    instruction: string,
    projectId: string,
    token: string,
    history: AgentTurn[] = []
  ): Promise<AgentRunResult> {
    let config;
    try {
      config = this.models.getModelConfig(ModelType.TOOL_CALLING);
    } catch (error) {
      this.logger.warn(`Cannot act: ${(error as Error).message}`);
      return {
        said: '',
        used: [],
        awaitingApproval: false,
        model: null,
        unavailable: 'No model is configured for this.',
      };
    }

    let session: McpSession | undefined;
    try {
      session = await this.tools.session(token);
      const used: AgentRunResult['used'] = [];
      const tools = await this.toolsFor(session, used);

      const agent = createReactAgent({
        llm: this.models.getModel(ModelType.TOOL_CALLING),
        tools,
        // Given only as a leading message, the id was not attended to: the
        // model asked which project to work on, having been told twice.
        // createReactAgent carries this on every turn instead.
        prompt: this.systemPrompt(projectId),
      });

      const run = await agent.invoke({
        messages: [
          new SystemMessage(this.systemPrompt(projectId)),
          ...rememberedTurns(history, ProjectAgentService.TURNS_REMEMBERED),
          // The id goes in the instruction as well. It is the one fact the
          // tools cannot proceed without, and repeating it costs nothing next
          // to a turn spent asking for it.
          new HumanMessage(`${instruction}\n\nprojectId: ${projectId}`),
        ],
      });

      const messages = run.messages ?? [];
      const said = String(messages[messages.length - 1]?.content ?? '');

      return {
        said,
        used,
        awaitingApproval: saysAwaitingApproval(used),
        model: config.name,
      };
    } catch (error) {
      this.logger.warn(`Agent run failed: ${(error as Error).message}`);
      return {
        said: '',
        used: [],
        awaitingApproval: false,
        model: config.name,
        unavailable: 'The agent could not finish just now.',
      };
    } finally {
      await session?.close();
    }
  }

  /**
   * The MCP tools, as tools the model can call.
   *
   * Every result is recorded on the way past. An agent that reports "created
   * the task" when the tool answered "waiting for approval" is the failure
   * this whole feature guards against, and the only way to catch it is to keep
   * what the tools actually said.
   */
  async toolsFor(
    session: McpSession,
    used: AgentRunResult['used']
  ): Promise<DynamicStructuredTool[]> {
    const listed = await session.listTools();

    return listed.map(
      (tool) =>
        new DynamicStructuredTool({
          name: tool.name,
          description: tool.description ?? tool.name,
          schema: this.schemaFor(tool.inputSchema),
          func: async (input: Record<string, unknown>) => {
            const result = await session.callTool(tool.name, input);
            const text = JSON.stringify(result);
            used.push({ tool: tool.name, result: text });
            return text;
          },
        })
    );
  }

  /**
   * The tool's own JSON schema, as Zod.
   *
   * Only the top level is translated. The tools here take flat objects of
   * strings, and a general JSON-Schema-to-Zod translation would be a lot of
   * code guarding against shapes none of them use.
   */
  private schemaFor(inputSchema: unknown) {
    const schema = inputSchema as {
      properties?: Record<string, { description?: string }>;
      required?: string[];
    };
    const required = new Set(schema?.required ?? []);
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [name, property] of Object.entries(schema?.properties ?? {})) {
      const field = z.string().describe(property?.description ?? name);
      shape[name] = required.has(name) ? field : field.optional();
    }

    return z.object(shape);
  }

  private systemPrompt(projectId: string): string {
    return [
      'You are working on one project for the person who asked you.',
      '',
      `The project id is ${projectId}.`,
      'Use exactly that string wherever a tool asks for projectId. You already',
      'have it, so never ask which project this is.',
      '',
      'Use the tools to do what was asked. Do not describe what you would do,',
      'and do not ask questions you can answer from what you were given.',
      '',
      // Without this the model reports the intent it had rather than the
      // answer it got, and a proposal waiting for a person reads to the
      // reader as work already done.
      'Report what the tools told you, not what you meant to happen. If a',
      'tool says something is waiting for approval, say that it is waiting',
      'for approval and that it has not happened yet.',
      '',
      // Asked for one task's status, it called query_tasks and then wrote
      // several hundred words describing the JSON it got back: a field
      // inventory, a total of every duration, and an offer to draw a Gantt
      // chart. The answer was in there and never said.
      'Answer the question you were actually asked, in a sentence or two, the',
      'way a colleague would. What the tools return is working material, not',
      'the answer: never describe it, inventory its fields, total things',
      'nobody asked about, or offer further analysis.',
      '',
      'No headings and no bullet lists unless you are listing several things',
      'somebody asked to see. Name tasks and people by their names rather',
      'than their ids.',
    ].join('\n');
  }
}
