import { normalizeIncrementalAccessibilityMetadata } from '../pdf/pdf-incremental-accessibility-metadata-admission.mjs';
import { writeIncrementalPdfAccessibilityMetadata } from '../pdf/pdf-incremental-accessibility-metadata-writer.mjs';
import { result, sha256 } from './support.mjs';
import {
  accessibilityTableSemantics,
  accessibilityFormSemantics,
} from './accessibility-ops.mjs';
import {
  accessibilityLinksBookmarks,
  accessibilityScreenReaderPermissions,
} from './accessibility-ops-extra.mjs';

export {
  accessibilityTableSemantics,
  accessibilityFormSemantics,
  accessibilityLinksBookmarks,
  accessibilityScreenReaderPermissions,
};

function remediablePassivePdf() {
  // Classic passive single-page PDF without tags/forms/title hazards (writer subset).
  const chunks = ['%PDF-1.7\n'];
  const offsets = new Map();
  const object = (number, body) => {
    offsets.set(number, Buffer.byteLength(chunks.join(''), 'latin1'));
    chunks.push(`${number} 0 obj\n${body}\nendobj\n`);
  };
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Count 1 /Kids [3 0 R] >>');
  object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>');
  const stream = 'q\nQ\n';
  offsets.set(4, Buffer.byteLength(chunks.join(''), 'latin1'));
  chunks.push(`4 0 obj\n<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream\nendobj\n`);
  const xref = Buffer.byteLength(chunks.join(''), 'latin1');
  chunks.push('xref\n0 1\n0000000000 65535 f \n');
  for (const [number, offset] of offsets) {
    chunks.push(`${number} 1\n${String(offset).padStart(10, '0')} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.from(chunks.join(''), 'latin1');
}

export function accessibilityDocumentLanguageTitle(ctx = {}) {
  const metadata = normalizeIncrementalAccessibilityMetadata({
    language: ctx.lang ?? 'en',
    title: ctx.title ?? 'Document',
  });
  const written = writeIncrementalPdfAccessibilityMetadata(remediablePassivePdf(), metadata);
  const pdf = written.bytes;
  return result('accessibility.document-language-title', {
    method: 'local-lang-title-pdf',
    lang: metadata.language,
    title: metadata.title,
    outputSha256: sha256(pdf),
    pdf,
    bytes: pdf.length,
    proof: written.proof,
  });
}

export const handlers = Object.freeze({
  async 'accessibility.table-semantics'(ctx = {}) { return accessibilityTableSemantics(ctx); },
  async 'accessibility.form-semantics'(ctx = {}) { return accessibilityFormSemantics(ctx); },
  async 'accessibility.links-bookmarks'(ctx = {}) { return accessibilityLinksBookmarks(ctx); },
  async 'accessibility.document-language-title'(ctx = {}) { return accessibilityDocumentLanguageTitle(ctx); },
  async 'accessibility.screen-reader-permissions'(ctx = {}) { return accessibilityScreenReaderPermissions(ctx); },
});
