import { databaseLoggingStatus } from './database-logging-status';
const safe = {
  messages: 'fatal',
  errors: 'panic',
  statements: 'none',
  duration: 'off',
  duration_threshold: '-1',
  sample_threshold: '-1',
  shared_plugins: '',
  session_plugins: '',
  local_plugins: '',
  parse: 'off',
  rewrite: 'off',
  plan: 'off',
};
it('qualifies a configuration that suppresses SQL errors, statements, parameters and debug plans', async () => {
  const query = jest.fn(async () => [safe]);
  expect(await databaseLoggingStatus({ query })).toEqual({
    policyVersion: 1,
    active: true,
  });
  expect(query.mock.calls).toHaveLength(1);
});
it('rejects the default error logging boundary and unknown statement/audit/debug collectors', async () => {
  for (const [key, value] of Object.entries({
    messages: 'warning',
    errors: 'error',
    statements: 'all',
    duration: 'on',
    duration_threshold: '0',
    sample_threshold: '0',
    shared_plugins: 'pgaudit',
    session_plugins: 'pgaudit',
    local_plugins: 'unreviewed',
    parse: 'on',
    rewrite: 'on',
    plan: 'on',
  }))
    expect(
      await databaseLoggingStatus({
        query: async () => [{ ...safe, [key]: value }],
      })
    ).toEqual({ policyVersion: 1, active: false });
  expect(await databaseLoggingStatus({ query: async () => [] })).toEqual({
    policyVersion: 1,
    active: false,
  });
});
