/**
 * Social feature configuration
 */
export interface SocialFeatureConfig {
  enabled: boolean;
  showPosts?: boolean;
  showFollowing?: boolean;
  showComments?: boolean;
  allowAttachments?: boolean;
}

/**
 * Tasks feature configuration
 */
export interface TasksFeatureConfig {
  enabled: boolean;
  showCalendar?: boolean;
  allowRecurring?: boolean;
  enableTimers?: boolean;
}

/**
 * Blogging feature configuration
 */
export interface BloggingFeatureConfig {
  enabled: boolean;
  allowComments: boolean;
  moderateComments: boolean;
}

/**
 * Project planning feature configuration
 */
export interface ProjectPlanningFeatureConfig {
  enabled: boolean;
  showGantt: boolean;
  showKanban: boolean;
  allowRisks: boolean;
}

/**
 * Combined features configuration
 */
export interface FeaturesConfig {
  social?: SocialFeatureConfig;
  tasks?: TasksFeatureConfig;
  blogging?: BloggingFeatureConfig;
  projectPlanning?: ProjectPlanningFeatureConfig;
}
