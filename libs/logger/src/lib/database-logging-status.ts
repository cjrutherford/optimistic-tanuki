/** Qualifies the supported local PostgreSQL diagnostic boundary. SQL error
 * DETAIL can contain personal values even when application logging is safe. */
export async function databaseLoggingStatus(database: {
  query(sql: string): Promise<unknown>;
}): Promise<{ policyVersion: 1; active: boolean }> {
  const rows = await database.query(
    `SELECT current_setting('log_min_messages') AS messages, current_setting('log_min_error_statement') AS errors, current_setting('log_statement') AS statements, current_setting('log_duration') AS duration, current_setting('log_min_duration_statement') AS duration_threshold, current_setting('log_min_duration_sample') AS sample_threshold, current_setting('shared_preload_libraries') AS shared_plugins, current_setting('session_preload_libraries') AS session_plugins, current_setting('local_preload_libraries') AS local_plugins, current_setting('debug_print_parse') AS parse, current_setting('debug_print_rewritten') AS rewrite, current_setting('debug_print_plan') AS plan`
  );
  const row =
    Array.isArray(rows) && rows.length === 1
      ? (rows[0] as Record<string, unknown>)
      : undefined;
  const active =
    !!row &&
    ['fatal', 'panic'].includes(String(row['messages'])) &&
    row['errors'] === 'panic' &&
    row['statements'] === 'none' &&
    row['duration'] === 'off' &&
    row['duration_threshold'] === '-1' &&
    row['sample_threshold'] === '-1' &&
    ['shared_plugins', 'session_plugins', 'local_plugins'].every(
      (key) => row[key] === ''
    ) &&
    ['parse', 'rewrite', 'plan'].every((key) => row[key] === 'off');
  return { policyVersion: 1, active };
}
