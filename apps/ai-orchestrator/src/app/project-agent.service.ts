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
import { PersonaVoiceService, Voice } from './persona-voice.service';
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
 * Shortens a tool result without throwing away whichever end matters.
 *
 * Taking the first N characters cost a correct answer. list_tasks returns the
 * task list and then the count, so on a nineteen thousand character result the
 * count sat at character 19,886 and the cut removed it. The model counted the
 * visible array by eye and said seven; the payload said twelve. Nothing was
 * wrong with the question, the model or the window. The useful part was last.
 *
 * The tools now put their summaries first, and this keeps both ends anyway,
 * because the next tool to put something important at the end should not cost
 * another afternoon to find.
 */
export function shortenKeepingBothEnds(text: string, limit: number): string {
  if (text.length <= limit) return text;

  // Two thirds from the front, where a summary and the first rows are, and a
  // third from the back, where a total or a closing count tends to be.
  const front = Math.floor((limit * 2) / 3);
  const back = limit - front;
  return `${text.slice(0, front)}\n…[middle removed]…\n${text.slice(-back)}`;
}

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

/**
 * Tools the MCP server offers that this assistant does not get to hold.
 *
 * All four are about choosing a persona, which is the person's job and is done
 * in the menu. Leaving them bound gave the model a second, competing way to
 * decide who is speaking, and `refer_to_persona` composed the sentence "Would
 * you like me to connect you with Sam Codewell?". Nothing here can perform
 * that handoff, so it was an offer that could not be honoured, made in exactly
 * the offering voice the rules below exist to suppress.
 *
 * They stay on the MCP server, which other clients can use. This is only about
 * what the assistant reaches for.
 */
const NOT_THE_AGENTS_BUSINESS = new Set([
  'list_ai_personas',
  'get_ai_persona',
  'find_specialist_persona',
  'refer_to_persona',
]);

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

/** Everything one run needs to know. */
export interface AgentRunRequest {
  instruction: string;
  projectId: string | null;
  token: string;
  history?: AgentTurn[];
  /** Who to speak as. Null takes the persona whose job is running projects. */
  personaId?: string | null;
  /**
   * Called the moment a tool is used, before the answer exists.
   *
   * A question takes a minute or more, and a panel that says only "working on
   * it" for that long is indistinguishable from a broken one. Whoever is
   * watching gets to see it reading the project, or proposing a task, while it
   * happens.
   */
  onToolUsed?: (call: { tool: string; result: string }) => void;
  /**
   * Called with each piece of the answer as it is written.
   *
   * The final result still carries the whole thing, so a caller that ignores
   * this keeps working, and the fallback path when composing fails is
   * unchanged: whatever was streamed is replaced by what actually arrived.
   */
  onText?: (chunk: string) => void;
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
  /**
   * Who answered, so the panel can show a name and a face rather than "AI".
   *
   * Absent when no persona could be read, which is a working state: the
   * assistant still answers, just as nobody in particular.
   */
  spokenBy?: { id: string; name: string; blurb: string };
}

@Injectable()
export class ProjectAgentService {
  private readonly logger = new Logger(ProjectAgentService.name);

  constructor(
    private readonly models: ModelManager,
    private readonly tools: ToolsService,
    private readonly personas: PersonaVoiceService
  ) {}

  /**
   * How much of the thread is carried back in.
   *
   * Enough for the assistant to follow a conversation, bounded because every
   * turn is re-read by the model on every request and a thread left to grow
   * eventually costs more than it helps.
   */
  static readonly TURNS_REMEMBERED = 12;

  /**
   * One request object rather than six positional arguments.
   *
   * This had five and was about to take a sixth, at which point the call sites
   * stop being readable and the wrong thing lands in the wrong slot without
   * anything complaining. It also leaves room for the persona's tool scope,
   * which is coming.
   */
  async act(request: AgentRunRequest): Promise<AgentRunResult> {
    const {
      instruction,
      projectId,
      token,
      history = [],
      personaId = null,
      onToolUsed,
      onText,
    } = request;

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

    // Never allowed to stop a run. Without a persona the assistant answers as
    // nobody, which is how it has always answered until now.
    const voice = await this.personas.voiceFor(personaId);

    let session: McpSession | undefined;
    try {
      session = await this.tools.session(token);
      const used: AgentRunResult['used'] = [];
      const tools = await this.toolsFor(
        session,
        used,
        onToolUsed,
        voice?.tools
      );
      const prompt = this.systemPrompt(projectId, voice);

      const agent = createReactAgent({
        llm: this.models.getModel(ModelType.TOOL_CALLING),
        tools,
        // Given only as a leading message, the id was not attended to: the
        // model asked which project to work on, having been told twice.
        // createReactAgent carries this on every turn instead.
        prompt,
      });

      const run = await agent.invoke({
        messages: [
          new SystemMessage(prompt),
          ...rememberedTurns(history, ProjectAgentService.TURNS_REMEMBERED),
          // The id goes in the instruction as well when there is one. It is
          // the one fact the tools cannot proceed without, and repeating it
          // costs nothing next to a turn spent asking for it.
          new HumanMessage(
            projectId
              ? `${instruction}\n\nprojectId: ${projectId}`
              : instruction
          ),
        ],
      });

      const messages = run.messages ?? [];
      const itsOwnWords = String(messages[messages.length - 1]?.content ?? '');

      return {
        said: await this.compose(instruction, used, itsOwnWords, voice, onText),
        used,
        awaitingApproval: saysAwaitingApproval(used),
        model: config.name,
        ...(voice
          ? { spokenBy: { id: voice.id, name: voice.name, blurb: voice.blurb } }
          : {}),
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
   * The sentence a person reads, written by the model chosen for writing.
   *
   * The tool-calling model wrote this too, and it was bad at it in a specific
   * way: asked for one task's status it fetched the tasks and then described
   * the JSON it got back, field by field, with a total of every duration on
   * the project and an offer to draw a Gantt chart. The status was in the data
   * and never said. Rewriting the prompt to forbid exactly that changed
   * nothing, which is the point at which prompting stops being the answer.
   *
   * qwen3:8b holds the tool-calling slot because it produced correct tool
   * arguments on every pass of the pilot. Nobody ever measured it on writing a
   * reply. So it keeps the job it won and hands the answer to the model that
   * was chosen for conversation, which gets the question, what the tools
   * returned, and nothing else to do.
   *
   * Its own words are kept as the fallback. A composed answer that fails is
   * worse than a rambling one that arrived.
   */
  async compose(
    question: string,
    used: AgentRunResult['used'],
    itsOwnWords: string,
    voice?: Voice | null,
    /**
     * Called with each piece of the reply as it is written.
     *
     * The tools were already reported as they were used, and then the answer
     * arrived whole after a silent stretch that is most of the wait. This
     * model produces the reply a token at a time and the tokens were being
     * thrown away.
     */
    onText?: (chunk: string) => void
  ): Promise<string> {
    // Nothing was looked up, so there is nothing to answer from and the
    // composer would be inventing. Whatever it said stands.
    if (!used.length) return itsOwnWords;

    try {
      const model = this.models.getModel(ModelType.CONVERSATIONAL);
      const messages = [
        new SystemMessage(this.composerPrompt(voice)),
        new HumanMessage(this.composerInput(question, used)),
      ];

      // Without a listener there is nobody to stream to, and one call is
      // cheaper than a stream nobody reads.
      if (!onText) {
        const reply = await model.invoke(messages);
        return String(reply?.content ?? '').trim() || itsOwnWords;
      }

      let text = '';
      for await (const piece of await model.stream(messages)) {
        const chunk = String(piece?.content ?? '');
        if (!chunk) continue;
        text += chunk;
        onText(chunk);
      }
      return text.trim() || itsOwnWords;
    } catch (error) {
      this.logger.warn(
        `Could not compose a reply, using the agent's own: ${
          (error as Error).message
        }`
      );
      return itsOwnWords;
    }
  }

  /**
   * Where the personality actually earns its keep.
   *
   * This model writes the sentence a person reads, so this is the one prompt
   * where a voice changes anything a reader will notice. Same order as the
   * other: who they are first, what they must do last.
   */
  private composerPrompt(voice?: Voice | null): string {
    return [
      ...(voice ? [...voice.identityLines, ''] : []),
      'Somebody asked a question about their project. Tools were used to look',
      'things up. You are given what those tools returned. Answer the',
      'question.',
      '',
      'A sentence or two, the way a colleague would answer across a desk.',
      '',
      // Every one of these is something the tool-calling model did when it
      // was writing the reply itself.
      'Do not describe the data you were given, list its fields, total things',
      'nobody asked about, or offer further analysis. Do not use headings or',
      'bullets unless you are listing several things somebody asked to see.',
      'Name tasks and people by their names, never by their ids.',
      '',
      'If a tool says something is waiting for approval, say that it is',
      'waiting for approval and has not happened yet. If what you were given',
      'does not answer the question, say so plainly rather than guessing.',
      '',
      // It answered "four tasks" for a project with twelve, having been shown
      // a shortened list and no reason to doubt it.
      // Kept, and known to be unreliable. Asked how many tasks a project had,
      // with the list cut and marked SHORTENED, it answered seven. There were
      // twelve. A model this size cannot be talked out of counting what is in
      // front of it, so the real fix is a tool that returns the number instead
      // of a list to count.
      'If a result is marked SHORTENED, it is part of a longer list. Never',
      'count it, total it, or say what is or is not in it. Say that you can',
      'only see part of it and answer what you can from that part.',
    ].join('\n');
  }

  /**
   * How much of one tool result the composer is given.
   *
   * Measured, not guessed. At four thousand characters it answered "Strip the
   * old liner is currently IN_PROGRESS" in one sentence. Raised to sixteen
   * thousand it began describing the JSON instead of answering, the same
   * failure the tool-calling model had.
   *
   * That second measurement was taken against a context window nobody had set,
   * so the composer was being handed more than it could read and answering
   * from whatever survived. With the window set deliberately it has room for
   * roughly eight thousand tokens of prompt, and this sits well inside that.
   *
   * Still bounded, because the failure it guards against is real: more
   * material makes these small models describe rather than answer. A cut
   * result says that it was cut.
   */
  private static readonly RESULT_CHARS = 8000;

  /**
   * The question and what came back, saying so when a result was cut.
   *
   * Asked how many tasks a project had, the composer answered four. There were
   * twelve. The list had been shortened before it ever saw it, and it counted
   * what was in front of it with no way to know the rest existed. A confident
   * wrong number is worse than a refusal, so a shortened result now says it is
   * shortened and the prompt forbids counting from one.
   */
  private composerInput(
    question: string,
    used: AgentRunResult['used']
  ): string {
    const results = used
      .map((call) => {
        const cut = call.result.length > ProjectAgentService.RESULT_CHARS;
        return [
          `${call.tool} returned${
            cut ? ' (SHORTENED, not the whole list)' : ''
          }:`,
          shortenKeepingBothEnds(call.result, ProjectAgentService.RESULT_CHARS),
        ].join('\n');
      })
      .join('\n\n');

    return [
      `QUESTION\n${question}`,
      '',
      `WHAT THE TOOLS RETURNED\n${results}`,
    ].join('\n');
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
    used: AgentRunResult['used'],
    onToolUsed?: (call: { tool: string; result: string }) => void,
    /**
     * The tools this run may use, or null or undefined for all of them.
     *
     * Choosing a persona is meant to choose what can be done, not only who is
     * speaking, so the scope is read here from the outset even though nothing
     * sets it yet. A name that no tool answers to is ignored rather than
     * treated as an error: a stale scope should cost a capability, never a run.
     */
    scope?: string[] | null
  ): Promise<DynamicStructuredTool[]> {
    const all = await session.listTools();
    const offered = all.filter(
      (tool) => !NOT_THE_AGENTS_BUSINESS.has(tool.name)
    );
    const listed = scope
      ? offered.filter((tool) => scope.includes(tool.name))
      : offered;

    if (scope && listed.length !== scope.length) {
      this.logger.warn(
        `Scope named ${scope.length} tools and ${listed.length} exist`
      );
    }

    return listed.map(
      (tool) =>
        new DynamicStructuredTool({
          name: tool.name,
          description: tool.description ?? tool.name,
          schema: this.schemaFor(tool.inputSchema),
          func: async (input: Record<string, unknown>) => {
            const result = await session.callTool(tool.name, input);
            const text = JSON.stringify(result);
            const call = { tool: tool.name, result: text };
            used.push(call);
            onToolUsed?.(call);
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

  /**
   * Who is speaking, then what they must do, in that order and never the other
   * way round.
   *
   * The identity goes first and the rules go last, closest to the task, so a
   * persona can colour how the assistant sounds and can never argue with how
   * it behaves. The seeded personas would if they were allowed to: they were
   * written for a chatbot that hands out templates, and the rules below are
   * the outcome of three separate attempts to stop a small model doing exactly
   * that. A voice is worth having. It is not worth that.
   */
  private systemPrompt(projectId: string | null, voice?: Voice | null): string {
    return [
      ...(voice ? [...voice.identityLines, ''] : []),
      "You are working on this person's projects for them.",
      '',
      // What this persona can reach, before it is asked to do anything. The
      // tools it lacks are simply absent, and a model that cannot find a way
      // to do what was asked tends to invent one or claim it did it.
      ...(voice?.limits ? [voice.limits, ''] : []),
      // Without a project the assistant is not useless, it is just starting
      // further back: listing projects needs no project id. Saying so beats
      // refusing, and beats inventing an id.
      ...(projectId
        ? [
            `The project id is ${projectId}.`,
            'Use exactly that string wherever a tool asks for projectId. You',
            'already have it, so never ask which project this is.',
          ]
        : [
            'No project has been chosen. Use list_projects to see what there',
            'is. If the question is about one project and you cannot tell',
            'which, ask which one rather than guessing or picking the first.',
          ]),
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
