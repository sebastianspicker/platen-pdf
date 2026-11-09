import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createLocalApplication } from '../../src/host/bootstrap/local-application.mjs';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

test('a failed startup removes its private session folder', async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), 'platen-startup-test-'));
  const previousTmpdir = process.env.TMPDIR;
  process.env.TMPDIR = scratch;
  t.after(async () => {
    if (previousTmpdir === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previousTmpdir;
    await rm(scratch, { recursive: true, force: true });
  });
  class FailingPdfService { constructor() { throw new Error('startup failure fixture'); } }

  await assert.rejects(
    createLocalApplication({ root: repositoryRoot, port: 4199 }, { PdfServiceClass: FailingPdfService }),
    /startup failure fixture/,
  );
  assert.deepEqual((await readdir(scratch)).filter((name) => name.startsWith('platen-session-')), []);
});
