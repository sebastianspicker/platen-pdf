import {
  adminPolicyConfiguration,
  adminPluginAllowlist,
} from './integrations-admin-ops.mjs';

export const handlers = Object.freeze({
  async 'admin.policy-configuration'(ctx = {}) { return adminPolicyConfiguration(ctx); },
  async 'admin.plugin-allowlist'(ctx = {}) { return adminPluginAllowlist(ctx); },
});
