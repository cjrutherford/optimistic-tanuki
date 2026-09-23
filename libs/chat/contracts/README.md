# @optimistic-tanuki/chat-contracts

Provider-neutral chat DTOs and contract types for conversations and messages.
Single source for the chat-collector TCP surface consumed via the gateway and the
AI orchestrator (see E12/E13 in the bounded-context plan).

## Install

```bash
npm install @optimistic-tanuki/chat-contracts
```

## Usage

```ts
import { ChatMessageDto, MessageType } from '@optimistic-tanuki/chat-contracts';

const message: ChatMessageDto = {
  conversationId: 'conv_123',
  senderId: 'profile_123',
  content: 'Hello',
  recipientIds: ['profile_456'],
  type: MessageType.CHAT,
};
console.log(message);
```

## Canonical spellings

Recipient lists are always `recipientIds: string[]`. The AI orchestrator's legacy
`recipientId` (singular key) predates this contract and migrates onto it under O26.

## Runtime

This package is runtime-neutral and intended for TypeScript or JavaScript consumers in browser or Node.js environments.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
