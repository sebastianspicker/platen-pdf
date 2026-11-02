import {
  opSignCertificate,
} from './real-ops.mjs';

export const handlers = Object.freeze({
  async 'sign.certificate'(ctx = {}) { return opSignCertificate(ctx); },
});
