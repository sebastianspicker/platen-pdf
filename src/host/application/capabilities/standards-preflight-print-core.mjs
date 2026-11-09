import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { HostError } from '../../platform/runtime/host-error.mjs';
import { serializePreflightReportXml } from '../prepress/preflight-rules.mjs';
import { fail, sha256 } from './support.mjs';

const SHA256 = /^[0-9a-f]{64}$/u;
const PRINT_AUTHORITY = new WeakSet();
const SOURCE_BOUND_PRINT_CAPABILITIES = new Set([
  'preflight.profiles', 'preflight.reports', 'print.transparency-flattening',
  'print.bleed-marks', 'print.imposition', 'print.font-inspection-embedding',
  'print.image-resolution-compression',
  'color.convert', 'color.output-intents',
]);

function abort(signal) {
  if (signal?.aborted) throw new HostError('JOB_CANCELLED', 'Professional print delivery was cancelled.', 499);
}

function runtime(ctx) {
  if (!PRINT_AUTHORITY.has(ctx.printAuthority)) {
    fail('INVALID_PRODUCTION_AUTHORITY', 'Professional print delivery requires a composition-root authority.', 503);
  }
  return ctx.printAuthority;
}

function authority(ctx, key, label) {
  const value = runtime(ctx)[key];
  if (!value) fail('INVALID_PRODUCTION_AUTHORITY', `${label} is unavailable from the professional print authority.`, 503);
  return value;
}

async function retainedBytes(store, kind, id, expectedSha256, revokedCode, expectedSize) {
  const record = kind === 'artifact' ? store.getArtifact(id) : store.getDocument(id);
  const filePath = kind === 'artifact' ? record?.filePath : (record ? store.getSourcePath(id) : null);
  if (!record || record.sha256 !== expectedSha256
    || (expectedSize !== undefined && record.size !== expectedSize)
    || typeof filePath !== 'string') {
    fail(revokedCode, `The retained ${kind} no longer matches its validated receipt.`, 409);
  }
  const bytes = await readFile(filePath);
  if (bytes.length !== record.size || (expectedSize !== undefined && bytes.length !== expectedSize)
    || createHash('sha256').update(bytes).digest('hex') !== expectedSha256) {
    fail(revokedCode, `The retained ${kind} bytes no longer match its validated receipt.`, 409);
  }
  return bytes;
}

async function revokeAfterFailure(store, kind, id, error) {
  try {
    await (kind === 'artifact' ? store.deleteArtifact(id) : store.deleteDocument(id));
  } catch (cleanupError) {
    throw new HostError('PROFESSIONAL_PRINT_CLEANUP_FAILED', 'Professional print delivery could not revoke its failed retained output.', 500, {
      cause: new AggregateError([error, cleanupError]),
    });
  }
  throw error;
}

function retainedOutput(capabilityId, outcome) {
  if (capabilityId === 'print.transparency-flattening' && typeof outcome?.outputDocumentId === 'string') {
    return Object.freeze({ kind: 'document', id: outcome.outputDocumentId });
  }
  if (['print.bleed-marks', 'print.imposition'].includes(capabilityId)
    && typeof outcome?.artifactId === 'string') {
    return Object.freeze({ kind: 'artifact', id: outcome.artifactId });
  }
  if (['color.convert', 'color.output-intents'].includes(capabilityId)
    && typeof outcome?.artifactId === 'string') {
    return Object.freeze({ kind: 'artifact', id: outcome.artifactId });
  }
  return null;
}

/**
 * Composition-root boundary for services that can create or inspect retained
 * professional-print outputs. The opaque authority cannot be synthesized with
 * a prototype-shaped request object.
 */
export function createProfessionalPrintDelivery({ store, services, deliver, list }) {
  if (!store || !services || typeof deliver !== 'function' || typeof list !== 'function') {
    throw new TypeError('Professional print delivery requires the document store, real services, delivery entrypoint, and handler inventory.');
  }
  const printAuthority = Object.freeze({
    store,
    prepress: services.prepress,
    conversion: services.conversion,
    printerMarks: services.printerMarks,
    pdf: services.service,
  });
  PRINT_AUTHORITY.add(printAuthority);
  async function deliverSourceBound(capabilityId, context = {}) {
    if (!SOURCE_BOUND_PRINT_CAPABILITIES.has(capabilityId)) return deliver(capabilityId, context);
    if (typeof context.documentId !== 'string' || context.documentId.length === 0) {
      fail('SOURCE_DOCUMENT_UNAVAILABLE', 'Professional print delivery requires a source document id.', 503);
    }
    const { signal } = context;
    abort(signal);
    await store.verifySource(context.documentId);
    const source = store.getDocument(context.documentId);
    if (!SHA256.test(context.sourceSha256 ?? '') || context.sourceSha256 !== source?.sha256) {
      fail('SOURCE_VERSION_MISMATCH', 'Professional print delivery requires the current lowercase source digest.', 409);
    }
    const sourcePdf = await readFile(store.getSourcePath(context.documentId));
    let deliveredOutput = null;
    try {
      const sourceSha256 = createHash('sha256').update(sourcePdf).digest('hex');
      if (sourcePdf.length !== source.size || sourceSha256 !== source.sha256) {
        throw new HostError('SOURCE_INTEGRITY_FAILED', 'The authoritative professional print source changed during resolution.', 500);
      }
      await store.verifySource(context.documentId);
      abort(signal);
      const outcome = await deliver(capabilityId, { ...context, sourcePdf, sourceSha256, printAuthority });
      deliveredOutput = retainedOutput(capabilityId, outcome);
      await store.verifySource(context.documentId);
      const retainedSource = await readFile(store.getSourcePath(context.documentId));
      try {
        if (retainedSource.length !== source.size || createHash('sha256').update(retainedSource).digest('hex') !== source.sha256) {
          throw new HostError('SOURCE_INTEGRITY_FAILED', 'The professional print source changed during delivery.', 500);
        }
      } finally {
        retainedSource.fill(0);
      }
      abort(signal);
      return outcome;
    } catch (error) {
      if (deliveredOutput) {
        return revokeAfterFailure(store, deliveredOutput.kind, deliveredOutput.id, error);
      }
      throw error;
    } finally {
      sourcePdf.fill(0);
    }
  }
  return Object.freeze({ deliver: deliverSourceBound, deliverSourceBound, list });
}
function boundDocument(ctx, label = 'document') {
  const store = authority(ctx, 'store', 'DocumentStore');
  if (typeof ctx.documentId !== 'string' || ctx.documentId.length === 0) fail('SOURCE_DOCUMENT_UNAVAILABLE', `${label} id is required.`, 503);
  const document = store.getDocument(ctx.documentId);
  if (!document || document.id !== ctx.documentId || !SHA256.test(document.sha256) || ctx.sourceSha256 !== document.sha256) fail('SOURCE_VERSION_MISMATCH', `${label} digest is not authoritative for the current document.`, 409);
  return document;
}
function strictReport(report, profile) {
  if (!report || report.kind !== 'preflight-review' || report.localOnly !== true || report.authoritative !== false
    || !Array.isArray(report.limitations) || report.limitations.length < 1 || !SHA256.test(report.reportSha256 ?? '')
    || report.profile?.id !== profile) fail('PREFLIGHT_REPORT_INVALID', 'The preflight report is not a strict local non-authoritative report.', 502);
  serializePreflightReportXml(report);
  return report;
}


export {
  SHA256, abort, runtime, authority, retainedBytes,
  revokeAfterFailure, retainedOutput, boundDocument, strictReport,
};
