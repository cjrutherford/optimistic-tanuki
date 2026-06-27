function compareList(label, expected, actual) {
  const missing = expected.filter((item) => !actual.includes(item));
  const extra = actual.filter((item) => !expected.includes(item));

  if (missing.length === 0 && extra.length === 0) {
    return [];
  }

  const errors = [];
  if (missing.length > 0) {
    errors.push(`${label} missing: ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    errors.push(`${label} unexpected: ${extra.join(', ')}`);
  }
  return errors;
}

function compareRequiredList(label, expected, actual) {
  const missing = expected.filter((item) => !actual.includes(item));
  if (missing.length === 0) {
    return [];
  }

  return [`${label} missing: ${missing.join(', ')}`];
}

function readStaticMatrixApps(job) {
  const include = job?.strategy?.matrix?.include;
  if (!Array.isArray(include)) {
    return null;
  }

  return include
    .map((entry) => entry?.app)
    .filter((app) => typeof app === 'string')
    .sort();
}

function hasDynamicMatrixResolver(job) {
  return (job?.steps ?? []).some(
    (step) =>
      typeof step?.run === 'string' &&
      ((step.run.includes('resolveDockerBuildMatrix') &&
        step.run.includes('plan.buildApps')) ||
        (step.run.includes('resolve-docker-changes.mjs') &&
          step.run.includes('--plan-file')))
  );
}

export function validateDockerWorkflowMatrix(
  label,
  workflow,
  producerJobName,
  consumerJobName,
  expectedApps
) {
  const producerJob = workflow?.jobs?.[producerJobName];
  const consumerJob = workflow?.jobs?.[consumerJobName];
  const staticMatrixApps = readStaticMatrixApps(consumerJob);

  if (staticMatrixApps) {
    return compareList(`${label} matrix apps`, expectedApps, staticMatrixApps);
  }

  const matrix = consumerJob?.strategy?.matrix;
  const hasDynamicRef =
    matrix != null &&
    ((typeof matrix === 'string' &&
      matrix.includes(`needs.${producerJobName}.outputs.matrix`)) ||
      (typeof matrix === 'object' &&
        Object.values(matrix).some(
          (v) =>
            typeof v === 'string' &&
            v.includes(`needs.${producerJobName}.outputs.matrix`)
        )));
  if (hasDynamicRef && hasDynamicMatrixResolver(producerJob)) {
    return [];
  }

  return [
    `${label} matrix configuration must use either a static include list or ${producerJobName} dynamic matrix output`,
  ];
}

export function validateComposeImageNames(
  expectedImageNames,
  composeImageNames
) {
  return compareRequiredList(
    'docker-compose image names',
    expectedImageNames,
    composeImageNames
  );
}
