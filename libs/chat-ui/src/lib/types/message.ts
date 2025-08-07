export interface ChatMessage {
    id: string;
    conversationId: string;
    senderId: string;
    recipientId: string[];
    content: string;
    timestamp: Date;
    type: 'chat' | 'info' | 'warning' | 'system';
};

export interface ChatConversation {
    id: string;
    participants: string[]; // Array of user IDs
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
}