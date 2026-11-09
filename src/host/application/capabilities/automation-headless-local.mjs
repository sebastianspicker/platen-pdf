import { createHash } from 'node:crypto';
import { types as nodeTypes } from 'node:util';
import {
  canonicalWatchDirectory,
  snapshotPdfDirectory,
  stablePdfCandidates,
} from '../ocr/watch-folder.mjs';
import {
  AUTOMATION_INSPECT_PRESET,
  AUTOMATION_PRESET_IDS,
  automationPresetDescriptor,
} from '../automation/automation-operation-contract.mjs';
import { AUTOMATION_SEQUENCE_IDS, automationSequenceDescriptor } from '../automation/automation-sequence-contract.mjs';
import {
  AUTOMATION_JS_LIMITATIONS,
  AUTOMATION_JS_PROFILE,
} from '../automation/automation-js-contract.mjs';
import { automationJsExecutionId } from '../automation/automation-js-contract.mjs';
import { conditionalExecutionId } from '../automation/automation-conditional-workflow-contract.mjs';
import { AutomationJsRecipeRegistry } from '../automation/automation-js-registry.mjs';
import { HostError } from '../../platform/runtime/host-error.mjs';
import { result, fail, requireString } from './support.mjs';
import {
  AUTOMATION_SERVICE_REQUIRED,
  callerBinding,
  checkedApiJob,
  checkedConditionalExecution,
  checkedJavascriptExecution,
  checkedQueueResponse,
  checkedScheduleResult,
  exactResultArray,
  operationSelection,
  plainData,
  requiredService,
  SEQUENCE_OPS,
  sourceBinding,
  submitRequest,
} from './automation-headless-contract.mjs';
import { parseCronFive } from './automation-headless-cron.mjs';

export function automationVariablesPresets(ctx = {}) {
  const requested = ctx.preset === undefined
    ? AUTOMATION_PRESET_IDS
    : [requireString(ctx.preset, 'preset', { min: 1, max: 128 })];
  const table = requested.map((id) => {
    const descriptor = automationPresetDescriptor(id);
    const fields = Object.freeze({ ...descriptor.fields });
    const variables = Object.freeze(Object.fromEntries(Object.entries(fields).map(([name, value]) => [
      name,
      Object.freeze({ type: Array.isArray(value) ? 'array' : typeof value, default: value }),
    ])));
    return Object.freeze({
      name: descriptor.id,
      version: descriptor.version,
      operation: descriptor.type,
      variables,
      presetId: createHash('sha256').update(`${descriptor.id}|${descriptor.version}|${JSON.stringify(fields)}`).digest('hex').slice(0, 16),
    });
  });
  return result('automation.variables-presets', {
    method: 'local-automation-allowlisted-presets',
    presets: Object.freeze(table),
    count: table.length,
    typed: true,
    immutable: true,
    limitations: Object.freeze([
      'Only three host-defined preset descriptors are listed; user-defined presets, arbitrary variables, code or expression evaluation, and durable execution are not exposed.',
    ]),
  });
}

export async function automationJobQueueRetry(ctx = {}) {
  const api = requiredService(ctx, 'api');
  if (typeof api.status !== 'function') fail(AUTOMATION_SERVICE_REQUIRED, 'Automation API status is unavailable.', 503);
  const caller = callerBinding(ctx);
  const jobId = requireString(ctx.jobId, 'jobId', { min: 1, max: 128 });
  if (ctx.action !== undefined && ctx.action !== 'status' && ctx.action !== 'cancel') {
    fail('INVALID_AUTOMATION_INPUT', 'Only status and cancel are exposed at the queue boundary; retry and resume are worker-owned.', 400);
  }
  const request = { principal: caller.principal, grant: caller.grant, jobId };
  const before = checkedApiJob(await api.status(request), jobId);
  let after = before;
  if (ctx.action === 'cancel') {
    if (typeof api.cancel !== 'function') fail(AUTOMATION_SERVICE_REQUIRED, 'Automation API cancellation is unavailable.', 503);
    after = checkedApiJob(await api.cancel(request), jobId);
  }
  const retry = before.retry;
  return result('automation.job-queue-retry', {
    method: 'local-automation-api-retry-status',
    action: ctx.action === 'cancel' ? 'cancel' : 'status',
    job: after,
    retry,
    retryable: Boolean(retry && ['transient', 'interrupted'].includes(retry.classification)),
    limitations: Object.freeze([
      'Retry admission is owned by the durable worker after transient engine failures; this boundary does not forge or replay jobs.',
    ]),
  });
}

export async function automationProcessingReports(ctx = {}) {
  const api = requiredService(ctx, 'api');
  if (typeof api.status !== 'function') fail(AUTOMATION_SERVICE_REQUIRED, 'Automation API status is unavailable.', 503);
  const caller = callerBinding(ctx);
  if (!Array.isArray(ctx.jobs) || ctx.jobs.length < 1 || ctx.jobs.length > 500) fail('INVALID_AUTOMATION_INPUT', 'jobs must be a bounded list of job IDs.', 400);
  const jobs = [];
  for (const entry of ctx.jobs) {
    const item = plainData(entry, 'report job', ['jobId']);
    const jobId = requireString(item.jobId, 'jobId', { min: 1, max: 128 });
    jobs.push(checkedApiJob(await api.status({ principal: caller.principal, grant: caller.grant, jobId }), jobId));
  }
  const counts = { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
  for (const job of jobs) {
    counts[job.status] += 1;
  }
  const report = Object.freeze({
    kind: 'automation-processing-report',
    total: jobs.length,
    pending: counts.pending,
    running: counts.running,
    completed: counts.completed,
    failed: counts.failed,
    cancelled: counts.cancelled,
    statuses: Object.freeze(jobs.map((job) => Object.freeze({ id: job.id, status: job.status, attempts: job.attempts, retry: job.retry }))),
    successRate: jobs.length === 0 ? 0 : counts.completed / jobs.length,
  });
  return result('automation.processing-reports', {
    method: 'local-automation-api-processing-report',
    report,
    reportSha256: createHash('sha256').update(JSON.stringify(report)).digest('hex'),
    localOnly: true,
  });
}
