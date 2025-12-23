export class ChatMessage {
  id: string;
  conversationId: string;
  senderName: string;
  senderId: string;
  recipientId: string[];
  recipientName: string[];
  content: string;
  timestamp: Date;
  role: 'assistant' | 'user' | 'tool' | 'system';
  type: 'chat' | 'info' | 'warning' | 'system';
}

export class ChatConversation {
  id: string;
  participants: string[]; // Array of user IDs
  messages: ChatMessage[];
  privacy: 'public' | 'private' | 'team';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: string,
    participants: string[],
    privacy: 'public' | 'private' | 'team' = 'private'
  ) {
    this.id = id;
    this.participants = participants;
    this.privacy = privacy;
    this.messages = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  addMessage(message: ChatMessage) {
    this.messages.push(message);
    this.updatedAt = new Date();
  }
}
