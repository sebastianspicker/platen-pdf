import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runPluginPackageCommand } from '../../src/cli/commands/plugin-package.mjs';
import { PluginPackageStore } from '../../src/host/application/plugins/plugin-package-store.mjs';
import { TrustedPublisherStore } from '../../src/host/application/security/trusted-publisher-store.mjs';

test('plugin package changes are refused without the local admin policy', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'platen-plugin-policy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packages = await new PluginPackageStore({ root, trustedPublishers: new TrustedPublisherStore() }).initialize();
  const refused = { code: 'ADMIN_POLICY_REQUIRED', status: 403 };
  await assert.rejects(packages.install('{}'), refused);
  await assert.rejects(packages.select('acme.tool', '1.0.0'), refused);
  await assert.rejects(packages.restorePreviousSelection('acme.tool'), refused);
  assert.deepEqual(packages.listPlugins(), []);
});

test('CLI reports an applied plugin change whose audit record could not be written', async () => {
  const calls = [];
  const application = {
    pluginPackages: {
      listPlugins: () => [], install: async () => {}, restorePreviousSelection: async () => {},
      async select(id, version) { calls.push(['select', id, version]); },
      getPlugin: (id) => ({ id, selectedVersion: '1.0.0' }),
    },
    adminAudit: { async append() { throw new Error('disk full'); } },
  };
  const runtime = {
    cancelled() {},
    fail(code, message) { throw Object.assign(new Error(message), { code }); },
    async outputValue() { calls.push(['output']); },
  };
  await assert.rejects(
    runPluginPackageCommand(application, { action: 'select', pluginId: 'acme.tool', version: '1.0.0' }, null, undefined, runtime),
    { code: 'ADMIN_AUDIT_INCOMPLETE', message: /applied.*audit record could not be written/ },
  );
  assert.deepEqual(calls, [['select', 'acme.tool', '1.0.0']]);
});
