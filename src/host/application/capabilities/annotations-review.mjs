import {
  reviewAnnotationFlatten,
} from './annotations-review-extra.mjs';
export {
  reviewAnnotationFlatten,
} from './annotations-review-extra.mjs';

export const handlers = Object.freeze({
  async 'review.annotation-flatten'(ctx = {}) { return reviewAnnotationFlatten(ctx); },
});
