import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getProfessionalHandler,
  professionalHandlers,
} from '../../src/host/application/capabilities/capability-delivery-registry.mjs';

const catalog = JSON.parse(readFileSync(new URL('../../catalog/capabilities.json', import.meta.url), 'utf8'));
const deliveryById = new Map(catalog.map((capability) => [capability.id, capability.delivery]));

test('every professional handler is an implemented catalog capability', () => {
  for (const id of Object.keys(professionalHandlers)) {
    assert.equal(deliveryById.get(id), 'implemented', `${id} must be implemented in catalog/capabilities.json`);
  }
});

test('planned capabilities have no professional handler', () => {
  assert.throws(
    () => getProfessionalHandler('standards.pdf-a'),
    (error) => error.code === 'PROFESSIONAL_HANDLER_MISSING',
  );
  assert.equal(typeof getProfessionalHandler('print.bleed-marks'), 'function');
});
