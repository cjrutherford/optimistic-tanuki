/**
 * Represents a reaction on a message.
 */
export interface MessageReaction {
  emoji: string;
  userId: string;
  userName?: string;
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
}
