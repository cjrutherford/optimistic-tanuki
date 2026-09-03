/**
 * Represents a reaction on a message.
 */
export interface MessageReaction {
  emoji: string;
  userId: string;
  userName?: string;
}

/**
 * What an assistant did while producing a message, alongside what it said.
 *
 * A person-to-person message is only its text. A message from an assistant has
 * a second half: the tools it called, and whether anything it did is still
 * waiting on somebody. Its own words are the one source that cannot be trusted
 * to reveal that nothing actually happened, so this is carried separately
 * rather than folded into the text.
 *
 * Presentation-ready on purpose. Whoever builds these knows what a tool name
 * means and what counts as a caution; this library only renders what it is
 * given, and gains no opinion about projects or approvals.
 */
export interface AssistantNote {
  /** What it did, in words a reader recognises. */
  did?: { what: string; pending?: boolean }[];
  /** Set when something it did is waiting on a person, with what to say. */
  awaiting?: string;
  /** A caveat about the answer itself, such as having seen part of a list. */
  caution?: string;
  /**
   * Things this message is waiting on a yes or no for.
   *
   * Deliberately not "changes" or "proposals": this library does not know what
   * is being decided, only that a message can carry decisions and that the
   * reader can make them here rather than somewhere else.
   */
  decisions?: { id: string; what: string }[];
}

/**
 * Represents a single chat message.
 */
export interface ChatMessage {
  /**
   * The unique identifier for the message.
   */
  id: string;
  /**
   * The ID of the conversation this message belongs to.
   */
  conversationId: string;
  /**
   * The ID of the user who sent the message.
   */
  senderId: string;
  /**
   * An array of user IDs who are the recipients of the message.
   */
  recipientId: string[];
  /**
   * The content of the message.
   */
  content: string;
  /**
   * The timestamp when the message was sent.
   */
  timestamp: Date;
  /**
   * The type of the message.
   */
  type: 'chat' | 'info' | 'warning' | 'system';
  /**
   * Array of reactions on the message.
   */
  reactions?: MessageReaction[];
  /**
   * Whether the message has been edited.
   */
  isEdited?: boolean;
  /**
   * Whether the message has been deleted.
   */
  isDeleted?: boolean;
  /**
   * Array of user IDs who have read the message.
   */
  readBy?: string[];
  /**
   * Present on messages an assistant produced. Additive: every existing
   * message is unaffected and every existing caller keeps compiling.
   */
  assistant?: AssistantNote;
}

/**
 * Represents a chat conversation.
 */
export interface ChatConversation {
  /**
   * The unique identifier for the conversation.
   */
  id: string;
  /**
   * An array of user IDs who are participants in the conversation.
   */
  participants: string[]; // Array of user IDs
  /**
   * An array of chat messages in the conversation.
   */
  messages: ChatMessage[];
  /**
   * The timestamp when the conversation was created.
   */
  createdAt: Date;
  /**
   * The timestamp when the conversation was last updated.
   */
  updatedAt: Date;
  /**
   * Optional participant profile directory for sender resolution.
   */
  participantProfiles?: Array<{
    id: string;
    name: string;
    profilePic?: string;
    avatarUrl?: string;
  }>;
}
