import { ChatConversation, ChatMessage } from '@optimistic-tanuki/chat-ui';

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

/** The persona speaking, when one is known. */
export interface Speaker {
  id: string;
  name: string;
}

export function asConversation(
  turns: AssistantTurn[],
  speaker: Speaker | null,
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

  return {
    id: assistantId,
    participants: [READER, assistantId],
    messages,
    createdAt: new Date(),
    updatedAt: new Date(),
    participantProfiles: [
      { id: READER, name: readerName },
      { id: assistantId, name: assistantName },
    ],
  };
}

/** What an assistant turn did, in words, or nothing when it did nothing. */
function noteFor(turn: AssistantTurn): ChatMessage['assistant'] {
  const did = (turn.used ?? []).map((call) => ({
    what: describeTool(call.tool),
    pending: wasProposed(call),
  }));

  return {
    ...(did.length ? { did } : {}),
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
