export interface ChatMessage {
    id: string;
    conversationId: string;
    senderId: string;
    recipientId: string[];
    content: string;
    timestamp: Date;
    type: 'chat' | 'info' | 'warning' | 'system';
};