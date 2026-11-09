import { buildPdfCompactRewrite } from '../pdf/pdf-compact-rewrite.mjs';
import {
  digest,
  factoryFromContext,
  result,
  sourcePdfBytes,
} from './create-convert-lib.mjs';

export async function optimizeCompress(context = {}) {
  const factory = factoryFromContext(context);
  if (typeof context?.conversion?.rewriteDocument === 'function' && context?.documentId) {
    const document = await context.conversion.rewriteDocument(context.documentId, 'optimize', {
      signal: context.signal,
    });
    return result('optimize.compress', {
      documentId: document.id,
      pageCount: document.operation?.validation?.pageCount,
      size: document.size,
      sha256: document.sha256,
      operationType: document.operation?.type,
      mediaType: 'application/pdf',
    });
  }
  const source = sourcePdfBytes(context, factory);
  const rewritten = buildPdfCompactRewrite(source);
  const reduced = rewritten.bytes.length < source.length;
  const bytes = reduced ? rewritten.bytes : source;
  return result('optimize.compress', {
    bytes,
    size: bytes.length,
    originalSize: source.length,
    savedBytes: source.length - bytes.length,
    reduced,
    sha256: digest(bytes),
    pageCount: context.pageCount ?? 1,
    mediaType: 'application/pdf',
    reachableObjectCount: rewritten.summary.reachableObjectCount,
    sourceSha256: digest(source),
    path: 'buildPdfCompactRewrite',
  });
}
