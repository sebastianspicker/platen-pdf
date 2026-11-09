import {
  automationJobQueueRetry,
  automationProcessingReports,
  automationVariablesPresets,
} from './automation-headless-local.mjs';
import {
  automationActionSequences,
  automationConditionalWorkflows,
  automationJavascript,
  automationScheduledJobs,
  automationWatchFolders,
} from './automation-headless-workflows.mjs';

export {
  automationActionSequences,
  automationConditionalWorkflows,
  automationJavascript,
  automationJobQueueRetry,
  automationProcessingReports,
  automationScheduledJobs,
  automationVariablesPresets,
  automationWatchFolders,
};

export const handlers = Object.freeze({
  async 'automation.watch-folders'(ctx = {}) { return automationWatchFolders(ctx); },
  async 'automation.action-sequences'(ctx = {}) { return automationActionSequences(ctx); },
  async 'automation.javascript'(ctx = {}) { return automationJavascript(ctx); },
  async 'automation.scheduled-jobs'(ctx = {}) { return automationScheduledJobs(ctx); },
  async 'automation.conditional-workflows'(ctx = {}) { return automationConditionalWorkflows(ctx); },
  async 'automation.variables-presets'(ctx = {}) { return automationVariablesPresets(ctx); },
  async 'automation.job-queue-retry'(ctx = {}) { return automationJobQueueRetry(ctx); },
  async 'automation.processing-reports'(ctx = {}) { return automationProcessingReports(ctx); },
});
