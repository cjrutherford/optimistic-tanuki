import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ChatContact,
  ChatConversation,
  ChatMessage,
  ChatWindowComponent,
} from '@optimistic-tanuki/chat-ui';
import { avatarFor } from '@optimistic-tanuki/profile-ui';

/** One message in a project's conversation. */
export interface ProjectMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt?: string;
}

/**
 * A project's conversation, rendered through the shared chat window.
 *
 * The chat window already has a message list, a composer and a popout state.
 * This component only translates project messages and members into what that
 * window renders, the same split `ai-assistant-bubble.component.ts` makes for
 * the assistant's own thread.
 */
@Component({
  selector: 'lib-project-conversation',
  standalone: true,
  imports: [CommonModule, ChatWindowComponent],
  templateUrl: './project-conversation.component.html',
  styleUrl: './project-conversation.component.scss',
})
export class ProjectConversationComponent {
  @Input() messages: ProjectMessage[] = [];
  @Input() people: { profileId: string; name?: string }[] = [];
  @Input() viewerProfileId = '';
  @Input() title = 'Project';
  @Input() unavailable: string | null = null;
  @Output() sent = new EventEmitter<string>();

  /** Who is in the conversation, for the window's own header and avatars. */
  get contact(): ChatContact[] {
    return this.people.map((person) => {
      const name = person.name || person.profileId;
      return {
        id: person.profileId,
        name,
        avatarUrl: avatarFor(name),
      };
    });
  }

  private built: ChatConversation | null = null;
  private builtFrom = '';

  /**
   * The messages as the chat window wants them, built only when they changed.
   *
   * A plain getter rebuilds the conversation, and every message in it, on
   * every change detection pass. The window compares its `[messages]` input
   * by reference, so a fresh object every pass makes it scroll to the bottom
   * every pass, and the message list keys messages by identity, so it tears
   * down and rebuilds every one of them continuously. This is the exact bug
   * fixed in `ai-assistant-bubble.component.ts`; the fix is the same here:
   * cache on a key built from what the conversation is actually made of.
   */
  get conversation(): ChatConversation {
    const last = this.messages.length
      ? this.messages[this.messages.length - 1].id
      : '';
    const from = [
      this.messages.length,
      last,
      this.viewerProfileId,
      this.title,
      this.people.length,
    ].join('~');

    if (!this.built || from !== this.builtFrom) {
      this.built = this.build();
      this.builtFrom = from;
    }
    return this.built;
  }

  private build(): ChatConversation {
    const messages: ChatMessage[] = this.messages.map((message) => ({
      id: message.id,
      conversationId: this.title,
      senderId: message.senderId,
      recipientId: this.people
        .map((person) => person.profileId)
        .filter((id) => id !== message.senderId),
      content: message.content,
      // The real time the message was sent, not the time it happened to be
      // rendered. A timestamp minted per render would move on its own even
      // when nothing about the message changed.
      timestamp: message.createdAt ? new Date(message.createdAt) : new Date(),
      type: 'chat',
    }));

    return {
      id: this.title,
      participants: this.people.map((person) => person.profileId),
      messages,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Without this the window shows "Unknown" for anybody it cannot
      // resolve by profile id.
      participantProfiles: this.people.map((person) => ({
        id: person.profileId,
        name: person.name || person.profileId,
        avatarUrl: avatarFor(person.name || person.profileId),
      })),
    };
  }
}
