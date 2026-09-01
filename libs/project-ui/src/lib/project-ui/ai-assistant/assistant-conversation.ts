import { ChatConversation, ChatMessage } from '@optimistic-tanuki/chat-ui';
import { avatarFor } from '@optimistic-tanuki/profile-ui';

/**
 * Turns the assistant's thread into a conversation the chat window can render.
 *
 * The chat window is built for people talking to people and knows nothing
 * about projects, tools or approvals, which is right: it should not have to.
 * Everything that needs domain knowledge happens here, and what crosses into
 * the library is already in words a reader understands.
 *
 * This exists because the assistant had its own chat implementation, built
 * beside a library that already had a message list, a composer, a popout
 * window and a thinking indicator. Rather than teach that library about
 * project tools, the turns are translated into what it already renders.
 */

/** One exchange in the assistant's thread. */
export interface AssistantTurn {
  role: 'person' | 'assistant';
  text: string;
  /** Tools called while producing this turn, for the assistant's turns. */
  used?: { tool: string; result: string }[];
  awaitingApproval?: boolean;
  failed?: boolean;
}

/** The one identity every person's turn is attributed to. */
export const READER = 'you';

/** Used when no persona could be read, so a turn still has an author. */
export const NOBODY_IN_PARTICULAR = 'assistant';

/** The tool name, in words, so the list reads as actions rather than API. */
export function describeTool(tool: string): string {
  const words: Record<string, string> = {
    list_projects: 'looked at your projects',
    get_project: 'read the project',
    query_tasks: 'searched the tasks',
    list_tasks: 'listed the tasks',
    count_tasks: 'counted the tasks',
    create_task: 'proposed a new task',
    update_task: 'proposed a change to a task',
    delete_task: 'tried to delete a task',
    create_risk: 'proposed a risk',
    update_risk: 'proposed a change to a risk',
    create_change: 'proposed a change record',
    create_journal_entry: 'proposed a journal entry',
    list_risks: 'listed the risks',
    query_risks: 'searched the risks',
  };
  return words[tool] ?? tool.replace(/_/g, ' ');
}

/** True when a tool call was turned into a proposal rather than carried out. */
export function wasProposed(call: { result: string }): boolean {
  return /waiting for approval/i.test(call.result);
}

/**
 * Whether the assistant only saw part of a list while answering.
 *
 * A list tool returns a page and says whether there is more behind it. The
 * assistant is not told to mention that and usually does not, so an answer
 * drawn from the first twenty five of two hundred reads exactly like one drawn
 * from all of them.
 *
 * Read from what the tools returned rather than from what the assistant said,
 * for the same reason the approval notice is: its own account is the one
 * source that cannot be trusted to reveal what it missed.
 */
export function sawOnlyPartOfAList(turn: AssistantTurn): boolean {
  return (turn.used ?? []).some(
    (call) =>
      /"more"\s*:\s*true/.test(call.result) || /SHORTENED/.test(call.result)
  );
}

/**
 * The proposal a gated tool filed, dug out of what it returned.
 *
 * The gate answers with the change it created, and that answer travels back
 * through MCP wrapped in a content envelope and then stringified again by the
 * agent. So the id is real and reachable, two JSON.parse calls down, and
 * without it the reader is told something is waiting and has to go and find
 * it on another page.
 *
 * Every step is guarded. A tool result that will not parse costs the buttons,
 * never the answer.
 */
export function proposalIn(call: {
  result: string;
}): { id: string; what: string } | null {
  const payload = unwrap(call.result);
  const proposal = payload?.['proposal'] as Record<string, unknown> | undefined;
  const id = proposal?.['id'];
  if (typeof id !== 'string' || !id) return null;

  const operation = proposal['operation'];
  return {
    id,
    what: typeof operation === 'string' ? describeOperation(operation) : 'this',
  };
}

/** MCP wraps a tool's answer in a content envelope, then it is stringified. */
function unwrap(result: string): Record<string, unknown> | null {
  const outer = parse(result);
  if (!outer) return null;

  const content = outer['content'];
  if (Array.isArray(content)) {
    const text = (content[0] as { text?: unknown } | undefined)?.text;
    if (typeof text === 'string') return parse(text);
  }
  return outer;
}

function parse(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

/**
 * What a proposed operation would do, for a button that has to be read.
 *
 * The keys are the operations the gate actually files, which are dotted and
 * lowercase. Guessing them as CREATE_TASK put "Approve task.create" on a
 * button, which is the sort of thing that only shows up when somebody looks at
 * it: every one of these fell through the fallback and nothing failed.
 */
export function describeOperation(operation: string): string {
  const words: Record<string, string> = {
    'task.create': 'creating that task',
    'task.update': 'that change to the task',
    'task.delete': 'deleting that task',
    'taskNote.create': 'adding that note',
    'risk.create': 'recording that risk',
    'risk.update': 'that change to the risk',
    'change.create': 'that change record',
    'projectJournal.create': 'that journal entry',
  };
  if (words[operation]) return words[operation];

  // "someEntity.create" reads as "create some entity" rather than as itself.
  const [entity, verb] = operation.split('.');
  if (entity && verb) {
    const words = entity.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    return `${verb} the ${words}`;
  }
  return operation.toLowerCase().replace(/_/g, ' ');
}

/** The persona speaking, when one is known. */
export interface Speaker {
  id: string;
  name: string;
}

export function asConversation(
  turns: AssistantTurn[],
  speaker: Speaker | null,
  /**
   * The answer so far, while it is still being written.
   *
   * Shown as a turn rather than as a status line, because it is the answer and
   * belongs where the finished one will be. It is replaced by the real turn
   * when that arrives, which is also what makes the fallback correct: when
   * composing fails the agent's own words are used, and those are not what was
   * streamed.
   */
  partial = '',
  readerName = 'You'
): ChatConversation {
  const assistantId = speaker?.id ?? NOBODY_IN_PARTICULAR;
  const assistantName = speaker?.name ?? 'Assistant';

  const messages: ChatMessage[] = turns.map((turn, index) => {
    const mine = turn.role === 'person';
    return {
      // Stable within a render and never sent anywhere. The turns themselves
      // carry no id, because nothing has ever needed to refer to one.
      id: `turn-${index}`,
      conversationId: assistantId,
      senderId: mine ? READER : assistantId,
      recipientId: [mine ? assistantId : READER],
      content: turn.text,
      timestamp: new Date(),
      type: turn.failed ? 'warning' : 'chat',
      ...(mine ? {} : { assistant: noteFor(turn) }),
    };
  });

  if (partial) {
    messages.push({
      id: 'being-written',
      conversationId: assistantId,
      senderId: assistantId,
      recipientId: [READER],
      content: partial,
      timestamp: new Date(),
      type: 'chat',
    });
  }

  return {
    id: assistantId,
    participants: [READER, assistantId],
    messages,
    createdAt: new Date(),
    updatedAt: new Date(),
    participantProfiles: [
      { id: READER, name: readerName, avatarUrl: avatarFor(readerName) },
      {
        id: assistantId,
        name: assistantName,
        avatarUrl: avatarFor(assistantName),
      },
    ],
  };
}

/** What an assistant turn did, in words, or nothing when it did nothing. */
function noteFor(turn: AssistantTurn): ChatMessage['assistant'] {
  const did = (turn.used ?? []).map((call) => ({
    what: describeTool(call.tool),
    pending: wasProposed(call),
  }));

  const decisions = (turn.used ?? [])
    .map((call) => proposalIn(call))
    .filter((proposal): proposal is { id: string; what: string } => !!proposal);

  return {
    ...(did.length ? { did } : {}),
    ...(decisions.length ? { decisions } : {}),
    ...(turn.awaitingApproval
      ? {
          awaiting:
            'Nothing has happened yet. It is waiting for your approval.',
        }
      : {}),
    ...(sawOnlyPartOfAList(turn)
      ? {
          caution:
            'It only saw part of that list, so treat anything about totals or all of them with care.',
        }
      : {}),
  };
}
