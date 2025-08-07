export class ChatMessage {
    id: string;
    conversationId: string;
    senderId: string;
    recipientId: string[];
    content: string;
    timestamp: Date;
    type: 'chat' | 'info' | 'warning' | 'system';
}

export class ChatConversation {
    id: string;
    participants: string[]; // Array of user IDs
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;

    constructor(id: string, participants: string[]) {
        this.id = id;
        this.participants = participants;
        this.messages = [];
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    addMessage(message: ChatMessage) {
        this.messages.push(message);
        this.updatedAt = new Date();
    }
}