import { isAllowedHost } from './static-files.mjs';
import { asHostError, HostError } from '../../platform/runtime/host-error.mjs';
import {
  decodeDisplayName, empty, hasToken, json, method, parsePositiveInteger,
  parseSnapshotRegion, readBytes, readJson, requireContentType,
  requireLocalFetchMetadata, requireSameOrigin, sendArtifact, sendPortableProject, write,
} from './http-boundary.mjs';
import { handleArtifactRoute } from './routes/artifact-routes.mjs';
import { handleAnnotationFlattenRoute } from './routes/annotation-flatten-routes.mjs';
import { handleBootstrapRoute } from './routes/bootstrap-routes.mjs';
import { handleConversionRoute } from './routes/conversion-routes.mjs';
import { handleDocumentServiceRoute } from './routes/document-service-routes.mjs';
import { handleIncrementalMetadataRoute } from './routes/incremental-metadata-routes.mjs';
import { handleIncrementalBleedBoxRoute } from './routes/incremental-bleed-box-routes.mjs';
import { handleIncrementalGoToLinkRoute } from './routes/incremental-goto-link-routes.mjs';
import { handleIncrementalNamedDestinationRoute } from './routes/incremental-named-destination-routes.mjs';
import { handleIncrementalPageVectorRoute } from './routes/incremental-page-vector-routes.mjs';
import { handleIncrementalPageTransitionRoute } from './routes/incremental-page-transition-routes.mjs';
import { handlePageTextRoute } from './routes/page-text-routes.mjs';
import { handleTextReflowRoute } from './routes/text-reflow-routes.mjs';
import { handleFileAudioAttachmentRoute } from './routes/file-audio-attachment-routes.mjs';
import { handleReviewMeasurementRoute } from './routes/review-measurement-routes.mjs';
import { handleReviewAnnotationImportExportRoute } from './routes/review-annotation-import-export-routes.mjs';
import { handleCommentsToOfficeRoute } from './routes/comments-to-office-routes.mjs';
import { handleFormJavaScriptInventoryRoute } from './routes/form-javascript-inventory-routes.mjs';
import { handleXfaInspectionRoute } from './routes/xfa-inspection-routes.mjs';
import { handleReviewNotificationRoute } from './routes/review-notification-routes.mjs';
import { handleReviewSharedExchangeRoute } from './routes/review-shared-exchange-routes.mjs';
import { handleReviewSidecarRoute } from './routes/review-sidecar-routes.mjs';
import { handleFullPageRedactionBatchRoute, handleFullPageRedactionRoute } from './routes/full-page-redaction-routes.mjs';
import { handlePrinterMarksRoute } from './routes/printer-marks-routes.mjs';
import { handlePageBackgroundRoute } from './routes/page-background-routes.mjs';
import { handleSpecialistContentRoute } from './routes/specialist-content-routes.mjs';
import { handleCertificateSignRoute, handleSigningIdentityListRoute } from './routes/signing-identity-routes.mjs';
import { handleElectronicSigningIntentRoute } from './routes/electronic-signing-intent-routes.mjs';
import { handleDocumentRoutes } from './router-document-dispatch.mjs';
import { handleLayerDefaultsRoute } from './routes/layer-defaults-routes.mjs';
import { handleHiddenDataSanitizationRoute } from './routes/hidden-data-sanitization-routes.mjs';
import { handleAcroFormCheckboxRoute, handleAcroFormRadioRoute, handleAcroFormTextFieldRoute, handleAcroFormChoiceRoute, handleAcroFormSignatureFieldRoute, handleAcroFormBarcodeRoute } from './routes/acroform-routes.mjs';
import { handleAecMeasurementLegendRoute } from './routes/aec-measurement-legend-routes.mjs';
import { handleTaggedRemediationRoute } from './routes/tagged-remediation-routes.mjs';
import { handleProfessionalAccessibilityRoute } from './routes/professional-accessibility-routes.mjs';
import { handleJpegImageRoute } from './routes/jpeg-image-routes.mjs';
import { handleJpegImageReplacementRoute } from './routes/jpeg-image-replacement-routes.mjs';
import { handlePageLabelsRoute } from './routes/page-labels-routes.mjs';
import { handleAdvancedSearchRoute } from './routes/advanced-search-routes.mjs';
import { handleSensitivePatternRoute } from './routes/sensitive-pattern-routes.mjs';
import { handleRedactionOverlayLabelRoute } from './routes/redaction-overlay-label-routes.mjs';
import { handleOcrEditableRoute } from './routes/ocr-editable-routes.mjs';
import { handleIncrementalAccessibilityMetadataRoute } from './routes/incremental-accessibility-metadata-routes.mjs';
import { handleJavaScriptRemovalRoute } from './routes/javascript-removal-routes.mjs';
import { handleAttachmentRemovalRoute } from './routes/attachment-removal-routes.mjs';
import { handleOcrRoute } from './routes/ocr-routes.mjs';
import { handlePdfkitRoute } from './routes/pdfkit-routes.mjs';
import { handlePluginPlatformRoute } from './routes/plugin-platform-routes.mjs';
import { handleDomainCatalogRoute, handlePortableProjectImportRoute, handleWorkspaceRoute } from './routes/workspace-routes.mjs';
import { handleComparisonBatchRoute, handleWorkflowRoute } from './routes/workflow-routes.mjs';
import { handleCopyPageRoute } from './routes/copy-page-routes.mjs';
import { handleScannerDiscoveryRoute } from './routes/scanner-discovery-routes.mjs';
import { handleScannerAcquisitionRoute } from './routes/scanner-acquisition-routes.mjs';
import { handleBatesNumberingRoute } from './routes/bates-numbering-routes.mjs';
import { handleFastWebViewRoute } from './routes/fast-web-view-routes.mjs';
import { handleOoxmlExportRoute } from './routes/ooxml-export-routes.mjs';
import { handleComparisonPackageRoute } from './routes/comparison-package-routes.mjs';
import { handleAcroFormTabOrderTooltipRoute } from './routes/acroform-tab-order-tooltip-routes.mjs';
import { handleAcroFormFillValidationRoute } from './routes/acroform-fill-validation-routes.mjs';
import { handleAcroFormDataExportRoute } from './routes/acroform-data-export-routes.mjs';
import {
  normalizeOcrDocumentRequest, normalizeOcrLayoutRequest,
  validateOcrDocumentResult, validateOcrLayoutResult,
} from '../../../contracts/ocr-contract.js';

const ROUTES = Object.freeze({
  workspace: handleWorkspaceRoute, workflow: handleWorkflowRoute, incrementalMetadata: handleIncrementalMetadataRoute,
  incrementalBleedBox: handleIncrementalBleedBoxRoute, incrementalGoToLink: handleIncrementalGoToLinkRoute,
  incrementalNamedDestination: handleIncrementalNamedDestinationRoute, incrementalPageVector: handleIncrementalPageVectorRoute,
  incrementalPageTransition: handleIncrementalPageTransitionRoute, pageText: handlePageTextRoute, textReflow: handleTextReflowRoute,
  fileAudioAttachment: handleFileAudioAttachmentRoute, reviewMeasurement: handleReviewMeasurementRoute,
  reviewAnnotationImportExport: handleReviewAnnotationImportExportRoute, reviewSharedExchange: handleReviewSharedExchangeRoute,
  commentsToOffice: handleCommentsToOfficeRoute, reviewNotifications: handleReviewNotificationRoute, reviewSidecar: handleReviewSidecarRoute,
  formJavaScriptInventory: handleFormJavaScriptInventoryRoute, xfaInspection: handleXfaInspectionRoute, ooxmlExport: handleOoxmlExportRoute,
  ocrEditable: handleOcrEditableRoute, fullPageRedaction: handleFullPageRedactionRoute, fullPageRedactionBatch: handleFullPageRedactionBatchRoute,
  redactionOverlayLabel: handleRedactionOverlayLabelRoute, printerMarks: handlePrinterMarksRoute, pageBackground: handlePageBackgroundRoute,
  specialistContent: handleSpecialistContentRoute, layerDefaults: handleLayerDefaultsRoute, certificateSign: handleCertificateSignRoute,
  electronicSigningIntent: handleElectronicSigningIntentRoute, hiddenDataSanitization: handleHiddenDataSanitizationRoute,
  acroFormCheckbox: handleAcroFormCheckboxRoute, acroFormRadio: handleAcroFormRadioRoute, acroFormTextField: handleAcroFormTextFieldRoute,
  acroFormSignatureField: handleAcroFormSignatureFieldRoute, acroFormBarcode: handleAcroFormBarcodeRoute,
  acroFormTabOrderTooltip: handleAcroFormTabOrderTooltipRoute, acroFormFillValidation: handleAcroFormFillValidationRoute,
  acroFormDataExport: handleAcroFormDataExportRoute, comparisonPackage: handleComparisonPackageRoute, aecMeasurementLegend: handleAecMeasurementLegendRoute,
  taggedRemediation: handleTaggedRemediationRoute, professionalAccessibility: handleProfessionalAccessibilityRoute, jpegImage: handleJpegImageRoute,
  jpegImageReplacement: handleJpegImageReplacementRoute, pageLabels: handlePageLabelsRoute, advancedSearch: handleAdvancedSearchRoute,
  sensitivePatterns: handleSensitivePatternRoute, incrementalAccessibilityMetadata: handleIncrementalAccessibilityMetadataRoute,
  removal: handleRemovalRoutes, fastWebView: handleFastWebViewRoute, copyPage: handleCopyPageRoute, pdfkit: handlePdfkitRoute,
  acroFormChoice: handleAcroFormChoiceRoute, batesNumbering: handleBatesNumberingRoute, documentService: handleDocumentServiceRoute,
});

const LIMITS = Object.freeze({
  incrementalMetadata: 8_192, incrementalBleedBox: 2_048, incrementalGotoLink: 2_048, incrementalNamedDestination: 2_048,
  incrementalPageVector: 2_048, incrementalPageTransition: 2_048, pageText: 2_048, textReflow: 16_384,
  fileAudioAttachment: 32_768, reviewMeasurement: 32_768, reviewAnnotationImportExport: 32_768, reviewSharedExchange: 1024 * 1024,
  commentsToOffice: 32_768, reviewNotifications: 32_768, reviewSidecar: 32_768, formJavaScriptInventory: 2_048, xfaInspection: 2_048,
  fullPageRedaction: 1_024, fullPageRedactionBatch: 2_048, printerMarks: 4_096, pageBackground: 4_096,
  layerDefaults: 4_096, specialistContent: 2_048, certificateSignature: 4_096, hiddenDataSanitization: 1_024, taggedRemediation: 128 * 1024,
  jpegImage: 2_048, jpegImageReplacement: 2_048, pageLabels: 8_192, advancedSearch: 4_096, sensitivePatterns: 8_192, redactionOverlayLabel: 4_096,
  acroFormFillSave: 4_096, acroFormValidation: 32_768, acroFormDataExport: 256,
  incrementalAccessibilityMetadata: 2_048, copyPage: 2_048,
  pdfkit: 4_096, ooxmlExport: 2_048, acroFormChoice: 16_384, batesNumbering: 8_192, fastWebView: 2_048,
  professionalAccessibility: 128 * 1024, professionalPrintInspection: 2_048, professionalPrintTransparency: 2_048,
  pdfkitMutation: 8_192, pdfkitProtection: 2_048,
  javascriptRemoval: 2_048, attachmentRemoval: 1_024, annotationFlatten: 2_048,
});


function exactJsonObject(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}

function sanitizedEngineAvailability(records) {
  return records.map(({ name, version = null, available, reason = null }) => ({ name, version, available, reason }));
}

async function normalizedOcrOptions(service, processing, body, normalizer, code) {
  const languages = await service.ocrLanguages(processing);
  try {
    return normalizer(body, languages);
  } catch (error) {
    if (error?.code === 'OCR_CONTRACT_INVALID') throw new HostError(code, error.message, 400, { cause: error });
    throw error;
  }
}

function checkedOcrResult(value, validator) {
  try {
    return validator(value);
  } catch (error) {
    if (error?.code === 'OCR_CONTRACT_INVALID') {
      throw new HostError('INVALID_ENGINE_OUTPUT', 'The local OCR service returned an invalid versioned result.', 502, { cause: error });
    }
    throw error;
  }
}

async function handleRemovalRoutes(options) {
  const shared = {
    request: options.request, response: options.response, url: options.url,
    documentId: options.documentId, operation: options.operation, processing: options.processing,
    store: options.store, exactJsonObject, method, readJson, json,
  };
  if (await handleJavaScriptRemovalRoute({
    ...shared, javascriptRemoval: options.javascriptRemoval,
    bodyLimit: LIMITS.javascriptRemoval,
  })) return true;
  if (await handleAttachmentRemovalRoute({
    ...shared, attachmentRemoval: options.attachmentRemoval,
    bodyLimit: LIMITS.attachmentRemoval,
  })) return true;
  return handleAnnotationFlattenRoute({
    ...shared, annotationFlatten: options.annotationFlatten,
    bodyLimit: LIMITS.annotationFlatten,
  });
}

function apiRequestUrl(request, response, host, staticHandler) {
  let url;
  try {
    url = new URL(request.url ?? '/', `http://${host}`);
  } catch {
    json(response, 400, { error: { code: 'INVALID_PATH', message: 'Invalid request path.' } });
    return null;
  }
  if (!url.pathname.startsWith('/api/')) {
    staticHandler(request, response);
    return null;
  }
  return url;
}

function requestProcessing(request, response) {
  const controller = new AbortController();
  const cancel = () => {
    if (!response.writableEnded) controller.abort(new Error('Client disconnected'));
  };
  request.once('aborted', cancel);
  response.once('close', cancel);
  return { signal: controller.signal };
}

export function createAppHandler({
  staticHandler, store, service, workspaceState, token, host, port, inputs = null, conversion = null, ...services
}) {
  if (typeof staticHandler !== 'function' || !store || !service || !workspaceState || typeof token !== 'string') {
    throw new TypeError('createAppHandler requires staticHandler, store, service, workspaceState, and a session token.');
  }
  if (Boolean(inputs) !== Boolean(conversion)) {
    throw new TypeError('createAppHandler requires both inputs and conversion when conversion routes are enabled.');
  }
  const context = { ...services, store, service, inputs, conversion, workspaceState };
  return async (request, response) => {
    const url = apiRequestUrl(request, response, host, staticHandler);
    if (!url) return;
    const { pathname } = url;
    try {
      if (!isAllowedHost(request.headers.host, host, port)) throw new HostError('MISDIRECTED_REQUEST', 'Misdirected request.', 421);
      if (await handleBootstrapRoute({ ...context, token, pathname, request, response, method, requireLocalFetchMetadata, json, sanitizedEngineAvailability })) return;
      if (!hasToken(request, token)) throw new HostError('UNAUTHORIZED', 'A valid local session token is required.', 401);
      requireSameOrigin(request);
      const processing = requestProcessing(request, response);
      const routeContext = { ...context, pathname, request, response, url, processing, method, json, empty, readJson, readBytes, requireContentType, decodeDisplayName, exactJsonObject };
      if (await handlePluginPlatformRoute(routeContext)) return;
      if (await handleOcrRoute({ ...routeContext, normalizedOcrOptions, checkedOcrResult })) return;
      if (await handlePortableProjectImportRoute(routeContext)) return;
      if (await handleComparisonBatchRoute(routeContext)) return;
      if (await handleConversionRoute(routeContext)) return;
      if (await handleDomainCatalogRoute(routeContext)) return;
      if (await handleSigningIdentityListRoute(routeContext)) return;
      if (await handleScannerDiscoveryRoute(routeContext)) return;
      if (await handleScannerAcquisitionRoute(routeContext)) return;

      if (await handleDocumentRoutes({ ...routeContext, routes: ROUTES, limits: LIMITS, write, parsePositiveInteger,
        sendPortableProject, normalizedOcrOptions, checkedOcrResult, sendArtifact, parseSnapshotRegion })) return;
      if (await handleArtifactRoute({ pathname, request, response, url, store, method, empty, sendArtifact })) return;
      throw new HostError('NOT_FOUND', 'Local API endpoint not found.', 404);
    } catch (error) {
      if (response.destroyed) return;
      const hostError = asHostError(error);
      json(response, hostError.status, { error: { code: hostError.code, message: hostError.message } });
    }
  };
}

export { decodeDisplayName, hasToken, parsePositiveInteger, readBytes, readJson, requireLocalFetchMetadata, requireSameOrigin };
