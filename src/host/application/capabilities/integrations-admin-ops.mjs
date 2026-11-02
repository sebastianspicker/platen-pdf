/**
 * Admin professional-capability handlers (identity, policy, packaging).
 */
import { createHash } from 'node:crypto';
import { result } from './support.mjs';

function sha(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

export function adminPolicyConfiguration(ctx = {}) {
  const policy = Object.freeze({
    network: false,
    pluginExecution: false,
    maxUploadBytes: 64 * 1024 * 1024,
    ...((ctx.policy && typeof ctx.policy === 'object') ? ctx.policy : {}),
    network: false,
    pluginExecution: false,
  });
  return result('admin.policy-configuration', {
    method: 'local-admin-policy-config',
    policy,
    policySha256: sha(policy),
  });
}

export function adminPluginAllowlist(ctx = {}) {
  const allow = Array.isArray(ctx.allow) ? ctx.allow.map(String).slice(0, 100) : [];
  const policy = Object.freeze({
    defaultDeny: true,
    allowCount: allow.length,
  });
  return result('admin.plugin-allowlist', {
    method: 'local-admin-plugin-allowlist',
    allow: Object.freeze(allow),
    count: allow.length,
    defaultDeny: true,
    policy,
  });
}
