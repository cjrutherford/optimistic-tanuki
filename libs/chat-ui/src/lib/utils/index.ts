import { ChatContact } from '../chat-ui/chat-ui.component';
import { ChatMessage } from '../types/message';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

/**
 * Converts a ProfileDto to a ChatContact.
 */
export function profileDtoToChatContact(profile: ProfileDto): ChatContact {
  return {
    id: profile.id,
    name: profile.profileName,
    avatarUrl: profile.profilePic || 'https://placehold.co/60x60',
    lastMessage: '',
    lastMessageTime: '',
  };
}

/**
 * Filters contacts to only those participating in the conversation.
 */
export function filterContactsByConversation(
  contacts: ChatContact[],
  messages: ChatMessage[]
): ChatContact[] {
  const participantIds = new Set<string>();
  messages.forEach(msg => {
    participantIds.add(msg.senderId);
    if (Array.isArray(msg.recipientId)) {
      msg.recipientId.forEach(id => participantIds.add(id));
    } else {
      participantIds.add(msg.recipientId);
    }
  });
  return contacts.filter(contact => participantIds.has(contact.id));
}

/**
 * Constructs a conversation object with filtered contacts and last message.
 */
export function constructConversation(
  profiles: ProfileDto[],
  messages: ChatMessage[]
): ChatContact[] {
  const contacts = profiles.map(profileDtoToChatContact);
  const filteredContacts = filterContactsByConversation(contacts, messages);
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  // Optionally, update lastMessage and lastMessageTime for each contact
  filteredContacts.forEach(contact => {
    if (lastMessage && (lastMessage.senderId === contact.id || (Array.isArray(lastMessage.recipientId) && lastMessage.recipientId.includes(contact.id)))) {
      contact.lastMessage = lastMessage.content;
      contact.lastMessageTime = lastMessage.timestamp?.toString() ?? '';
    }
  });
  return filteredContacts;
}