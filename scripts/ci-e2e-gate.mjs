import { pathToFileURL } from 'node:url';

export function browserJobShouldRun(impactResult, shouldRun) {
  return impactResult !== 'success' || shouldRun !== 'false';
}

export function e2eGateSucceeds(impactResult, shouldRun, browserResult) {
  if (impactResult !== 'success') return false;
  if (shouldRun === 'false') return browserResult === 'skipped';
  if (shouldRun === 'true') return browserResult === 'success';
  return false;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const success = e2eGateSucceeds(
    process.env.IMPACT_RESULT,
    process.env.SHOULD_RUN,
    process.env.BROWSER_RESULT,
  );
  console.log(
    success ? 'E2E aggregate state is valid' : 'Unexpected E2E aggregate state',
  );
  process.exitCode = success ? 0 : 1;
}
