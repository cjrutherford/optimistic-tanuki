export const AudioProjectCommands = {
  CREATE: 'CREATE_AUDIO_PROJECT',
  GET: 'GET_AUDIO_PROJECT',
  UPDATE: 'UPDATE_AUDIO_PROJECT',
  DELETE: 'DELETE_AUDIO_PROJECT',
  LIST: 'LIST_AUDIO_PROJECTS',
} as const;

export const TrackCommands = {
  CREATE: 'CREATE_TRACK',
  UPDATE: 'UPDATE_TRACK',
  DELETE: 'DELETE_TRACK',
  LIST: 'LIST_TRACKS',
} as const;

export const MixCommands = {
  SAVE: 'SAVE_MIX_SNAPSHOT',
  GET: 'GET_MIX_SNAPSHOT',
  LIST: 'LIST_MIX_SNAPSHOTS',
} as const;

export const GenerationCommands = {
  REQUEST: 'REQUEST_GENERATION',
  STATUS: 'GENERATION_STATUS',
  CANCEL: 'CANCEL_GENERATION',
  LIST: 'LIST_GENERATIONS',
} as const;

export const ExportCommands = {
  START: 'START_EXPORT',
  STATUS: 'EXPORT_STATUS',
  LIST: 'LIST_EXPORTS',
} as const;

export const CollaborationMode = {
  FULL_AUTO: 'full-auto',
  COVER: 'cover',
  FULL_COLLAB: 'full-collab',
} as const;

export type CollaborationModeType =
  (typeof CollaborationMode)[keyof typeof CollaborationMode];
