import { result, requireString, fail } from './support.mjs';
import { PDF_JAVASCRIPT_REMOVAL_PROFILE } from '../pdf/pdf-javascript-removal-admission.mjs';

const FAMILY = 'security';
const SHA256 = /^[0-9a-f]{64}$/u;

function authority(ctx, key, methods, code) {
  const service = ctx[key];
  if (!service || methods.some((method) => typeof service[method] !== 'function')) {
    fail(code, 'The required local security authority is unavailable.', 503);
  }
  return service;
}

function documentId(ctx) {
  if (typeof ctx.documentId !== 'string' || ctx.documentId.trim().length < 1) {
    fail('SECURITY_DOCUMENT_REQUIRED', 'Security operations require an explicit document identity.', 400);
  }
  return ctx.documentId;
}

function sourceDigest(ctx) {
  if (!SHA256.test(String(ctx.sourceSha256 ?? ''))) {
    fail('SECURITY_SOURCE_DIGEST_REQUIRED', 'Security operations require the current lowercase source SHA-256.', 400);
  }
  return ctx.sourceSha256;
}

function credential(value, label) {
  try { return requireString(value, label, { min: 1, max: 128 }); } catch { fail('INVALID_SECURITY_CREDENTIAL', 'Security credentials are required and must be bounded strings.', 400); }
}

function receiptResult(capabilityId, receipt, expectedKind, expectedSourceDigest) {
  if (!receipt || typeof receipt !== 'object' || receipt.kind !== expectedKind
    || receipt.sourceDigest !== expectedSourceDigest || !receipt.artifact
    || typeof receipt.artifact.id !== 'string' || !SHA256.test(String(receipt.artifact.sha256 ?? ''))
    || receipt.artifact.sha256 === expectedSourceDigest || !receipt.evidence
    || receipt.evidence.artifactDigestBound !== true) {
    fail('SECURITY_RECEIPT_INVALID', 'The local security authority returned an invalid retained artifact receipt.', 502);
  }
  return result(capabilityId, {
    familyId: FAMILY,
    method: `production-${expectedKind}-service`,
    serviceReceipt: receipt,
    artifact: receipt.artifact,
    sourceSha256: expectedSourceDigest,
    outputSha256: receipt.artifact.sha256,
  });
}

export const handlers = Object.freeze({
  async 'security.permission-controls'(ctx = {}) {
    const service = authority(ctx, 'pdfkitProtection', ['protect'], 'SECURITY_PERMISSION_CONTROLS_UNAVAILABLE');
    const id = documentId(ctx); const sourceSha256 = sourceDigest(ctx);
    const permissionsProfile = credential(ctx.profile, 'permissionsProfile');
    const ownerPassword = credential(ctx.ownerPassword, 'ownerPassword');
    const userPassword = credential(ctx.userPassword ?? ctx.openPassword, 'userPassword');
    const receipt = await service.protect(id, { permissionsProfile, ownerPassword, userPassword }, { sourceSha256, signal: ctx.signal });
    return receiptResult('security.permission-controls', receipt, 'pdfkit-password-protection', sourceSha256);
  },

  async 'security.remove-protection'(ctx = {}) {
    const service = authority(ctx, 'pdfkitProtection', ['removeProtection'], 'SECURITY_PROTECTION_REMOVAL_UNAVAILABLE');
    const id = documentId(ctx); const sourceSha256 = sourceDigest(ctx);
    const artifactId = credential(ctx.artifactId, 'artifactId');
    const artifactSha256 = ctx.artifactSha256;
    if (!SHA256.test(String(artifactSha256 ?? ''))) fail('SECURITY_ARTIFACT_DIGEST_REQUIRED', 'Protection removal requires the retained artifact SHA-256.', 400);
    const ownerPassword = credential(ctx.ownerPassword, 'ownerPassword');
    const receipt = await service.removeProtection(id, { artifactId, artifactSha256, ownerPassword }, { sourceSha256, signal: ctx.signal });
    return receiptResult('security.remove-protection', receipt, 'pdfkit-protection-removal', artifactSha256);
  },

  async 'security.javascript-controls'(ctx = {}) {
    const service = authority(ctx, 'javascriptRemoval', ['remove'], 'SECURITY_JAVASCRIPT_CONTROLS_UNAVAILABLE');
    const id = documentId(ctx); const sourceSha256 = sourceDigest(ctx);
    if (ctx.profile !== PDF_JAVASCRIPT_REMOVAL_PROFILE) fail('INVALID_JAVASCRIPT_CONTROLS_OPTIONS', 'JavaScript controls require the fixed removal profile.', 400);
    const receipt = await service.remove(id, { profile: ctx.profile }, { sourceSha256, signal: ctx.signal });
    return receiptResult('security.javascript-controls', receipt, 'pdf-javascript-removal', sourceSha256);
  },

  async 'security.open-password'(ctx = {}) {
    const service = authority(ctx, 'pdfkitProtection', ['protect'], 'SECURITY_OPEN_PASSWORD_UNAVAILABLE');
    const id = documentId(ctx); const sourceSha256 = sourceDigest(ctx);
    const permissionsProfile = credential(ctx.permissionsProfile ?? ctx.profile, 'permissionsProfile');
    const ownerPassword = credential(ctx.ownerPassword, 'ownerPassword');
    const userPassword = credential(ctx.userPassword ?? ctx.openPassword, 'userPassword');
    const receipt = await service.protect(id, { permissionsProfile, ownerPassword, userPassword }, { sourceSha256, signal: ctx.signal });
    return receiptResult('security.open-password', receipt, 'pdfkit-password-protection', sourceSha256);
  },
});
