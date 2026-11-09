import { structuredTextExport } from '../../../contracts/document-analysis.js';
import { HostError } from '../../platform/runtime/host-error.mjs';
import { exportImages } from './create-convert-images.mjs';
import { optimizeCompress } from './create-convert-optimize.mjs';
import {
  CREATE_CONVERT_CAPABILITY_IDS,
  MAX_PAGE_POINTS,
  MIN_PAGE_POINTS,
  blankPdf,
  convertOfficeLike,
  cropPngRegion,
  digest,
  exportOoxml,
  extractPostScriptText,
  factoryFromContext,
  pageTextArray,
  pagesFromText,
  pdfHeaderOk,
  requireSourceBoundPngBytes,
  assertSourceBoundAdapter,
  pngBytesToPdf,
  requireBuffer,
  result
} from './create-convert-lib.mjs';

const handlers = Object.freeze({
  async 'create.blank-pdf'(context = {}) {
    const factory = factoryFromContext(context);
    if (typeof context?.conversion?.createBlank === 'function') {
      const document = await context.conversion.createBlank({
        pages: context.pages ?? 1,
        widthPoints: context.widthPoints ?? 612,
        heightPoints: context.heightPoints ?? 792,
        title: context.title ?? 'Untitled',
      });
      return result('create.blank-pdf', {
        documentId: document.id,
        pageCount: document.operation?.validation?.pageCount ?? context.pages ?? 1,
        size: document.size,
        sha256: document.sha256,
        mediaType: 'application/pdf',
      });
    }
    const pdf = blankPdf(context, factory);
    return result('create.blank-pdf', pdf);
  },

  async 'convert.office-to-pdf'(context = {}) {
    const factory = factoryFromContext(context);
    if (context.body !== undefined && typeof context.body !== 'string') {
      throw new HostError('INVALID_CAPABILITY_INPUT', 'body must be a string.', 400);
    }
    const officeContext = context.body === undefined
      ? context
      : { ...context, sourceBytes: Buffer.from(context.body, 'utf8'), extension: '.txt' };
    return convertOfficeLike(
      { ...officeContext, capabilityId: 'convert.office-to-pdf' },
      factory,
      { kind: 'office', title: context.title ?? 'Office conversion' },
    );
  },

  async 'convert.images-to-pdf'(context = {}) {
    const { sourceBytes, sourceSha256 } = requireSourceBoundPngBytes(context, { signal: context.signal });
    if (typeof context?.conversion?.convertInput === 'function' && context?.assetId) {
      if (typeof context.conversion.preparePngPdfExport !== 'function') {
        throw new HostError(
          'CONVERSION_INSUFFICIENT_SOURCE_BOUND',
          'convert.images-to-pdf conversion adapter is missing source-bound PNG export evidence.',
          503,
        );
      }
      const document = await context.conversion.convertInput(context.assetId, { signal: context.signal });
      assertSourceBoundAdapter(document, sourceSha256);
      const evidence = await context.conversion.preparePngPdfExport(document.id, { signal: context.signal });
      const pdfBytes = requireBuffer(evidence?.bytes, 'preparePngPdfExport.bytes');
      if (!pdfHeaderOk(pdfBytes)) {
        throw new HostError('INVALID_ENGINE_OUTPUT', 'convert.images-to-pdf adapter output is not a valid PDF.', 502);
      }
      const outputSha256 = digest(pdfBytes);
      if (document.sha256 && outputSha256 !== document.sha256) {
        throw new HostError('CONVERSION_OUTPUT_TAMPERED', 'Adapter output digest does not match the declared document digest.', 502);
      }
      const pageCount = Number.isSafeInteger(evidence?.inspection?.pageCount)
        ? evidence.inspection.pageCount
        : (Number.isSafeInteger(document?.operation?.validation?.pageCount) ? document.operation.validation.pageCount : 1);
      return result('convert.images-to-pdf', {
        documentId: document.id,
        bytes: pdfBytes,
        pageCount,
        size: pdfBytes.length,
        sourceSha256,
        sha256: outputSha256,
        mediaType: 'application/pdf',
        operationType: document.operation?.type,
        path: 'adapter-png-to-pdf',
      });
    }
    const pdf = pngBytesToPdf(sourceBytes, { title: context.title ?? 'Image conversion' });
    return result('convert.images-to-pdf', {
      ...pdf,
      sourceSha256,
      path: 'local-png-xobject',
    });
  },

  async 'create.clipboard-to-pdf'(context = {}) {
    const factory = factoryFromContext(context);
    if (context?.consent !== true && context?.consent !== undefined) {
      throw new HostError('CLIPBOARD_CONSENT_REQUIRED', 'Clipboard-to-PDF requires explicit local consent.', 403);
    }
    const clipboardText = String(context?.clipboardText ?? context?.text ?? '');
    if (typeof context?.conversion?.createText === 'function' && (context?.clipboardText != null || context?.text != null)) {
      const document = await context.conversion.createText({
        text: clipboardText,
        title: context.title ?? 'Clipboard',
      });
      return result('create.clipboard-to-pdf', {
        documentId: document.id,
        pageCount: 1,
        size: document.size,
        sha256: document.sha256,
        mediaType: 'application/pdf',
      });
    }
    const pdf = pagesFromText(clipboardText, { title: context.title ?? 'Clipboard' }, factory);
    return result('create.clipboard-to-pdf', { ...pdf, consent: context?.consent !== false });
  },

  async 'create.postscript-to-pdf'(context = {}) {
    const factory = factoryFromContext(context);
    if (typeof context?.conversion?.convertInput === 'function' && context?.assetId) {
      const document = await context.conversion.convertInput(context.assetId, { signal: context.signal });
      return result('create.postscript-to-pdf', {
        documentId: document.id,
        pageCount: document.operation?.validation?.pageCount ?? 1,
        size: document.size,
        sha256: document.sha256,
        operationType: document.operation?.type,
        mediaType: 'application/pdf',
      });
    }
    const source = requireBuffer(context?.sourceBytes ?? context?.inputBytes, 'sourceBytes');
    const text = extractPostScriptText(source);
    const pdf = pagesFromText(text, { title: context.title ?? 'PostScript conversion' }, factory);
    return result('create.postscript-to-pdf', { ...pdf, path: 'local-ps-show-subset' });
  },

  async 'export.word'(context = {}) {
    return exportOoxml('export.word', 'word', context);
  },

  async 'export.excel'(context = {}) {
    return exportOoxml('export.excel', 'excel', context);
  },

  async 'export.powerpoint'(context = {}) {
    return exportOoxml('export.powerpoint', 'powerpoint', context);
  },

  async 'export.text-rtf'(context = {}) {
    const pages = pageTextArray(context);
    const format = context?.format === 'text' ? 'text' : 'rtf';
    const exported = structuredTextExport(pages, format, { title: context?.title ?? 'PDF text export' });
    const data = exported.data;
    const bytes = Buffer.from(data, 'utf8');
    return result('export.text-rtf', {
      format: exported.extension === 'rtf' ? 'rtf' : 'text',
      extension: exported.extension,
      mediaType: exported.mediaType,
      bytes,
      data,
      size: bytes.length,
      sha256: digest(bytes),
      pageCount: pages.length,
      path: 'structuredTextExport',
    });
  },

  async 'export.html-xml'(context = {}) {
    const pages = pageTextArray(context);
    const format = context?.format === 'xml' ? 'xml' : 'html';
    const exported = structuredTextExport(pages, format, { title: context?.title ?? 'PDF export' });
    const data = exported.data;
    const bytes = Buffer.from(data, 'utf8');
    return result('export.html-xml', {
      format,
      extension: exported.extension,
      mediaType: exported.mediaType,
      bytes,
      data,
      size: bytes.length,
      sha256: digest(bytes),
      pageCount: pages.length,
      path: 'structuredTextExport',
    });
  },

  async 'export.images'(context = {}) { return exportImages(context); },

  async 'export.selected-region'(context = {}) {
    if (typeof context?.service?.renderCropBoxSnapshot === 'function' && context?.documentId) {
      const png = await context.service.renderCropBoxSnapshot(context.documentId, {
        page: context.page ?? 1,
        dpi: context.dpi ?? 72,
        region: context.region,
        signal: context.signal,
      });
      if (!Buffer.isBuffer(png) || png.length < 8) {
        throw new HostError('INVALID_ENGINE_OUTPUT', 'Selected-region export did not return PNG bytes.', 502);
      }
      return result('export.selected-region', {
        bytes: png,
        size: png.length,
        sha256: digest(png),
        mediaType: 'image/png',
        page: context.page ?? 1,
        path: 'renderCropBoxSnapshot',
      });
    }
    const source = requireBuffer(context?.pngBytes ?? context?.sourceBytes, 'pngBytes');
    const region = context?.region ?? { x: 0, y: 0, width: 1, height: 1 };
    const cropped = cropPngRegion(source, region);
    return result('export.selected-region', {
      ...cropped,
      region,
      path: 'local-png-region-crop',
    });
  },

  async 'optimize.compress'(context = {}) { return optimizeCompress(context); },
});

export { handlers };
export default handlers;

export { CREATE_CONVERT_CAPABILITY_IDS };
