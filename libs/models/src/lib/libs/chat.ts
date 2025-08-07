/**
 * Represents a chat message.
 */
export class ChatMessage {
    /**
     * The unique identifier of the message.
     */
    id: string;
    /**
     * The ID of the conversation the message belongs to.
     */
    conversationId: string;
    /**
     * The ID of the sender.
     */
    senderId: string;
    /**
     * The IDs of the recipients.
     */
    recipientId: string[];
    /**
     * The content of the message.
     */
    content: string;
    /**
     * The timestamp of the message.
     */
    timestamp: Date;
    /**
     * The type of the message.
     */
    type: 'chat' | 'info' | 'warning' | 'system';
}

/**
 * Represents a chat conversation.
 */
export class ChatConversation {
    /**
     * The unique identifier of the conversation.
     */
    id: string;
    /**
     * The participants in the conversation (array of user IDs).
     */
    participants: string[];
    /**
     * The messages in the conversation.
     */
    messages: ChatMessage[];
    /**
     * The creation timestamp of the conversation.
     */
    createdAt: Date;
    /**
     * The last update timestamp of the conversation.
     */
    updatedAt: Date;

    /**
     * Creates an instance of ChatConversation.
     * @param id The unique identifier of the conversation.
     * @param participants The participants in the conversation.
     */
    constructor(id: string, participants: string[]) {
        this.id = id;
        this.participants = participants;
        this.messages = [];
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    /**
     * Adds a message to the conversation.
     * @param message The message to add.
     */
    addMessage(message: ChatMessage) {
        this.messages.push(message);
        this.updatedAt = new Date();
    }
}