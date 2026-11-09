import {
  createProfessionalPrintDelivery,
} from './standards-preflight-print-core.mjs';
import {
  preflightProfiles, preflightReports, printTransparencyFlattening, printBleedMarks, printImposition,
  printFontInspectionEmbedding, printImageResolutionCompression,
} from './standards-preflight-print-ops.mjs';
import { colorConvert, colorOutputIntents } from './standards-preflight-color.mjs';

export {
  createProfessionalPrintDelivery, preflightProfiles, preflightReports,
  printTransparencyFlattening, printBleedMarks, printImposition,
  printFontInspectionEmbedding, printImageResolutionCompression,
  colorConvert, colorOutputIntents,
};

export const handlers = Object.freeze({
  async 'preflight.profiles'(ctx = {}) { return preflightProfiles(ctx); },
  async 'preflight.reports'(ctx = {}) { return preflightReports(ctx); },
  async 'color.convert'(ctx = {}) { return colorConvert(ctx); },
  async 'color.output-intents'(ctx = {}) { return colorOutputIntents(ctx); },
  async 'print.transparency-flattening'(ctx = {}) { return printTransparencyFlattening(ctx); },
  async 'print.bleed-marks'(ctx = {}) { return printBleedMarks(ctx); },
  async 'print.imposition'(ctx = {}) { return printImposition(ctx); },
  async 'print.font-inspection-embedding'(ctx = {}) { return printFontInspectionEmbedding(ctx); },
  async 'print.image-resolution-compression'(ctx = {}) { return printImageResolutionCompression(ctx); },
});
