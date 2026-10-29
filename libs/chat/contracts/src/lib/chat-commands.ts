export const CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES = [
  'Conversation',
  'Message',
] as const;

export const ChatCommands = {
  FENCE_ACCOUNT_DELETION: 'chat.deletion.fence',
  ERASE_ACCOUNT_DELETION: 'chat.deletion.erase',
  READBACK_ACCOUNT_DELETION: 'chat.deletion.readback',
  OPEN_ACCOUNT_EXPORT_CAPTURE: 'chat.OpenAccountExportCapture',
  READ_ACCOUNT_EXPORT_CAPTURE: 'chat.ReadAccountExportCapture',
  RELEASE_ACCOUNT_EXPORT_CAPTURE: 'chat.ReleaseAccountExportCapture',
  POST_MESSAGE: 'POST_MESSAGE',
  GET_CONVERSATIONS: 'GET_CONVERSATIONS',
  GET_CONVERSATION: 'GET_CONVERSATION',
  CREATE_COMMUNITY_CHAT: 'CREATE_COMMUNITY_CHAT',
  DELETE_OWNED_COMMUNITY_CONVERSATION: 'DELETE_OWNED_COMMUNITY_CONVERSATION',
  ADD_TO_COMMUNITY_CHAT: 'ADD_TO_COMMUNITY_CHAT',
  REMOVE_FROM_COMMUNITY_CHAT: 'REMOVE_FROM_COMMUNITY_CHAT',
  CREATE_ADDITIONAL_CHAT_ROOM: 'CREATE_ADDITIONAL_CHAT_ROOM',
  /** REST-friendly: get or create a 1:1 direct conversation */
  GET_OR_CREATE_DIRECT_CHAT: 'GET_OR_CREATE_DIRECT_CHAT',
  /** REST-friendly: retrieve all messages in a conversation */
  GET_MESSAGES: 'GET_MESSAGES',
  /** REST-friendly: send a message to an existing conversation */
  SEND_MESSAGE: 'SEND_MESSAGE',
  /** The conversation belonging to a project, made if it is not there yet. */
  GET_OR_CREATE_PROJECT_CHAT: 'GET_OR_CREATE_PROJECT_CHAT',
  GET_PRESENCE_AUDIENCE: 'GET_PRESENCE_AUDIENCE',
};

export default ChatCommands;
