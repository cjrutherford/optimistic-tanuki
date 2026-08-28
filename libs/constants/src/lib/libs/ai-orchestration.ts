export const AIOrchestrationCommands = {
  PROFILE_INITIALIZE: 'INITIALIZE_PROFILE',
  CONVERSATION_UPDATE: 'UPDATE_CONVERSATION',
  TELOS_UPDATE: 'UPDATE_TELOS',
  REFER_PERSONA: 'REFER_PERSONA',
};

export const WellnessAiCommands = {
  GENERATE_PROMPT: 'wellness-ai:generate-prompt',
  GET_CONTEXT: 'wellness-ai:get-context',
  GET_AFFIRMATION: 'wellness-ai:get-affirmation',
  GET_MINDFUL_ACTIVITY: 'wellness-ai:get-mindful-activity',
  ANALYZE_GRATITUDE: 'wellness-ai:analyze-gratitude',
  REFLECT_JUDGMENT: 'wellness-ai:reflect-judgment',
};

/**
 * Reading a project and saying something about it.
 *
 * Separate from the project-planning service's own commands because this runs
 * a model and that one owns data. The summary is derived, never stored, so a
 * stale one is impossible by construction.
 */
export const ProjectAiCommands = {
  SUMMARISE: 'project-ai:summarise',
  PROPOSE: 'project-ai:propose',
  ACT: 'project-ai:act',
};
