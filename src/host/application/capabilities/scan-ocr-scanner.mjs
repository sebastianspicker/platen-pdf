import { readFileSync } from 'node:fs';
import { createBlankPdf } from '../pdf/pdf-factory.mjs';
import { PDF_COPY_PAGE_PROFILE, PDF_COPY_PAGE_VALIDATORS } from '../pdf/pdf-copy-page-admission.mjs';
import { OPAQUE_ID } from '../../platform/storage/document-store-contract.mjs';
import { validateOperationProvenance } from '../../platform/storage/operation-provenance.mjs';
import { result, fail, requireBytes, sha256 } from './support.mjs';
const DIGEST = /^[0-9a-f]{64}$/;

function parseSelectionSelection(value) {
  if (!Array.isArray(value) || value.length < 1) return false;
  return value.every((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
    && typeof entry.input === 'number' && Number.isSafeInteger(entry.input) && entry.input >= 0
    && typeof entry.page === 'number' && Number.isSafeInteger(entry.page) && entry.page >= 1);
}

function readBoundBytes(value, label) {
  if (Buffer.isBuffer(value)) return value;
  try {
    if (typeof value?.path === 'string' && value.path.length > 0) return readFileSync(value.path);
  } catch (error) {
    fail('SCAN_OUTPUT_UNREADABLE', `${label} could not be read for verification.`, 502);
  }
  fail('SCAN_OUTPUT_UNREADABLE', `${label} must be deterministic bytes or provide a source path.`, 502);
}

function validateOperation(operation, code, message) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) fail(code, message, 502);
  try {
    return validateOperationProvenance(operation);
  } catch {
    fail(code, message, 502);
  }
}

function appendSourceRecord(ctx, role, expectedId, expectedSha256, expectedBytes) {
  const expectedDocumentId = String(expectedId ?? '').trim();
  if (!OPAQUE_ID.test(expectedDocumentId)) {
    fail('SCAN_APPEND_CONTEXT_INVALID', `${role} source document identifier is invalid.`, 400);
  }
  let record;
  try {
    record = ctx.store.getDocument(expectedDocumentId);
  } catch (error) {
    if (error?.code === 'DOCUMENT_NOT_FOUND') fail('SCAN_APPEND_CONTEXT_INVALID', `${role} source document was not found in the local store.`, 400);
    fail('SCAN_APPEND_OUTPUT_INVALID', `Could not read ${role.toLowerCase()} source document binding.`, 502);
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) fail('SCAN_APPEND_CONTEXT_INVALID', `${role} source document binding is malformed.`, 400);
  if (record.id !== expectedDocumentId || record.mediaType !== 'application/pdf' || record.size !== expectedBytes.length) {
    fail('SCAN_APPEND_CONTEXT_INVALID', `${role} source document binding does not match request context.`, 400);
  }
  if (!DIGEST.test(String(record.sha256 ?? '')) || record.sha256 !== expectedSha256) fail('SCAN_APPEND_CONTEXT_INVALID', `${role} source digest drifted from bound context.`, 409);
  if (!Number.isSafeInteger(record.size) || record.size < 1) fail('SCAN_APPEND_CONTEXT_INVALID', `${role} source record is invalid.`, 409);
  let boundBytes;
  try {
    boundBytes = readBoundBytes({ path: ctx.store.getSourcePath(expectedDocumentId) }, `${role} source binding`);
  } catch {
    fail('SCAN_APPEND_OUTPUT_INVALID', `Could not re-read ${role.toLowerCase()} source document bytes.`, 502);
  }
  if (boundBytes.length !== record.size || sha256(boundBytes) !== record.sha256) {
    fail('SCAN_APPEND_OUTPUT_INVALID', `${role} source document drifted before append composition.`, 502);
  }
  return {
    documentId: expectedDocumentId,
    sha256: record.sha256,
    size: record.size,
  };
}

function assertCopyPageArtifactProvenance(operation, expectedPageCount, primaryDocumentId, primarySourceSha256, secondaryDocumentId, secondarySourceSha256, sourcePage, afterPage) {
  const validated = validateOperation(operation, 'SCAN_APPEND_OPERATION_INVALID', 'scan.append-to-document operation provenance is malformed.');
  if (validated.type !== 'copy-page-between-documents') {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'The copy-page provenance type is incorrect.', 502);
  }
  if (!Array.isArray(validated.inputs) || validated.inputs.length !== 2) {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'The copy-page provenance is missing one source binding.', 502);
  }
  const hasPrimary = validated.inputs.some((input) => input.documentId === primaryDocumentId && input.role === 'primary' && input.sha256 === primarySourceSha256);
  const hasSecondary = validated.inputs.some((input) => input.documentId === secondaryDocumentId && input.role === 'secondary' && input.sha256 === secondarySourceSha256);
  if (!hasPrimary || !hasSecondary) {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'The copy-page provenance did not retain both source bindings.', 502);
  }
  if (validated.parameters?.profile !== PDF_COPY_PAGE_PROFILE || validated.parameters?.sourcePage !== sourcePage || validated.parameters?.afterPage !== afterPage) {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'The copy-page provenance did not retain the append request boundary.', 502);
  }
  if (!Number.isSafeInteger(validated.parameters?.sourcePage) || !Number.isSafeInteger(validated.parameters?.afterPage)) {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'The copy-page provenance request boundaries are malformed.', 502);
  }
  if (!Number.isSafeInteger(validated.expected?.pageCount) || validated.expected.pageCount !== expectedPageCount) {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'The copy-page expected page count is invalid.', 502);
  }
  if (!DIGEST.test(String(validated.expected?.manifestSha256 ?? ''))
    || validated.expected.manifestSha256 !== validated.validation?.manifestSha256) {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'The copy-page manifest provenance is inconsistent.', 502);
  }
  const expectedSelections = validated.expected.pageCount;
  if (!Array.isArray(validated.parameters?.selections) || validated.parameters.selections.length !== expectedSelections || !parseSelectionSelection(validated.parameters.selections)) {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'The copy-page provenance did not retain selection ordering.', 502);
  }
  const validators = Array.isArray(validated.validation?.validators) ? validated.validation.validators : [];
  if (!PDF_COPY_PAGE_VALIDATORS.every((validator) => validators.includes(validator))) {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'The copy-page validator set is incomplete.', 502);
  }
}

export async function scanAppendToDocument(ctx = {}) {
  if (ctx.network === true) fail('NETWORK_FORBIDDEN', 'Scanner acquisition is local-only.', 403);
  const base = requireBytes(ctx.sourcePdf ?? createBlankPdf({ pages: 1, title: 'base' }), 'sourcePdf');
  const scannedSource = requireBytes(ctx.scanSourcePdf ?? createBlankPdf({ pages: 1, title: 'append-source' }), 'scanSourcePdf');
  if (typeof ctx.service?.copyPageBetweenDocuments !== 'function' || typeof ctx.store !== 'object' || ctx.store === null
    || typeof ctx.store.getDocument !== 'function' || typeof ctx.store.getArtifact !== 'function' || typeof ctx.store.verifySource !== 'function'
    || typeof ctx.store.getSourcePath !== 'function') {
    fail('SCAN_APPEND_SERVICE_UNAVAILABLE', 'scan.append-to-document requires copy-page composition and source-bound document store.', 503);
  }
  const baseSha256 = sha256(base);
  const scannedSha256 = sha256(scannedSource);
  const primaryDocumentId = typeof ctx.documentId === 'string' ? ctx.documentId : '00000000-0000-4000-8000-000000000000';
  const secondaryDocumentId = typeof ctx.scanDocumentId === 'string' ? ctx.scanDocumentId : '00000000-0000-4000-8000-000000000001';
  const primaryInfo = appendSourceRecord(ctx, 'Primary', primaryDocumentId, baseSha256, base);
  const secondaryInfo = appendSourceRecord(ctx, 'Scanned', secondaryDocumentId, scannedSha256, scannedSource);
  const sourcePage = 1;
  const afterPage = Number.isSafeInteger(ctx.afterPage) ? ctx.afterPage : 0;
  if (afterPage < 0) fail('SCAN_APPEND_REQUEST_INVALID', 'afterPage must be non-negative.', 400);
  const request = Object.freeze({
    profile: PDF_COPY_PAGE_PROFILE,
    primarySourceSha256: primaryInfo.sha256,
    secondarySourceSha256: secondaryInfo.sha256,
    sourcePage,
    afterPage,
  });
  let copied;
  try {
    copied = await ctx.service.copyPageBetweenDocuments(primaryDocumentId, secondaryDocumentId, request, { signal: ctx.signal });
  } catch (error) {
    if (error?.code === 'INVALID_COPY_PAGE_REQUEST' || error?.code === 'COPY_PAGE_INPUT_TOO_LARGE') fail('SCAN_APPEND_REQUEST_INVALID', 'scan.append-to-document request was rejected by the copy-page service.', 400);
    if (error?.code === 'COPY_PAGE_SOURCE_UNSUPPORTED' || error?.code === 'POPPLER_WARNING') fail('SCAN_APPEND_OUTPUT_INVALID', 'scan.append-to-document returned an invalid copy-page receipt.', 502);
    throw error;
  }
  if (!copied || typeof copied !== 'object' || typeof copied.id !== 'string' || !OPAQUE_ID.test(copied.id)
    || copied.documentId !== primaryDocumentId || copied.mediaType !== 'application/pdf'
    || copied.documentId !== primaryDocumentId || !DIGEST.test(String(copied.sha256 ?? ''))
    || !Number.isSafeInteger(copied.size) || copied.size < 1) {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'scan.append-to-document did not receive an artifact receipt.', 502);
  }
  let artifact;
  try {
    artifact = await ctx.store.getArtifact(copied.id);
  } catch {
    fail('SCAN_APPEND_ARTIFACT_MISSING', 'scan.append-to-document could not read the retained append artifact.', 502);
  }
  if (artifact.id !== copied.id || artifact.documentId !== primaryDocumentId || artifact.mediaType !== 'application/pdf'
    || !DIGEST.test(String(artifact.sha256 ?? '')) || !Number.isSafeInteger(artifact.size) || artifact.size < 1) {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'scan.append-to-document returned an unbound or malformed artifact.', 502);
  }
  const operation = validateOperation(artifact.operation, 'SCAN_APPEND_OPERATION_INVALID', 'scan.append-to-document operation provenance is malformed.');
  if (copied.operation) {
    const copiedOperation = validateOperation(copied.operation, 'SCAN_APPEND_OPERATION_INVALID', 'scan.append-to-document receipt provenance is malformed.');
    if (JSON.stringify(copiedOperation) !== JSON.stringify(operation)) {
      fail('SCAN_APPEND_OUTPUT_INVALID', 'scan.append-to-document artifact receipt did not preserve operation provenance.', 502);
    }
  }
  const expectedOutputPageCount = operation.expected?.pageCount;
  assertCopyPageArtifactProvenance(operation, expectedOutputPageCount, primaryDocumentId, baseSha256, secondaryDocumentId, scannedSha256, sourcePage, afterPage);
  const pdf = readBoundBytes({ path: artifact.filePath }, 'scan append output');
  const outputSha256 = sha256(pdf);
  if (artifact.sha256 !== outputSha256 || artifact.size !== pdf.length) {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'scan.append-to-document output digest drifted from artifact binding.', 502);
  }
  if (copied.id !== artifact.id || copied.documentId !== artifact.documentId || copied.sha256 !== artifact.sha256 || copied.size !== artifact.size) {
    fail('SCAN_APPEND_OUTPUT_INVALID', 'scan.append-to-document artifact receipt drifted before publication.', 502);
  }
  return result('scan.append-to-document', {
    method: 'local-scan-append-pages',
    baseSha256,
    scannedSha256,
    sourcePageCount: operation.parameters.selections.filter((selection) => selection.input === 0).length,
    scannedPageCount: operation.parameters.selections.filter((selection) => selection.input === 1).length,
    sourceComposition: {
      base: { sha256: baseSha256, pageCount: operation.parameters.selections.filter((selection) => selection.input === 0).length },
      appendedScan: { sha256: scannedSha256, pageCount: operation.parameters.selections.filter((selection) => selection.input === 1).length },
    },
    artifactId: artifact.id,
    documentId: primaryDocumentId,
    outputSha256,
    outputDigest: outputSha256,
    pageCount: expectedOutputPageCount,
    structuralPageCount: expectedOutputPageCount,
    pdf,
    bytes: pdf.length,
    operation,
    receipt: copied,
    appendedPages: 1,
  });
}
