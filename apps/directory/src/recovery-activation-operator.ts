/** The legacy operator must not connect or modify either store. */
process.stderr.write(
  'Legacy recovery activation is disabled; six-field activation protocol is not implemented. Keep the external fence in place.\n'
);
process.exitCode = 1;
