/**
 * Local PDF portfolio / embedded-file collection packaging and inventory.
 */
import { createHash } from 'node:crypto';
import { freezeDeep, throwFail } from './capability-result.mjs';
import { assemblePortfolioPdf } from './portfolio-pdf-build.mjs';

const MAX_FILES = 32;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_NAME = 120;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizePortfolioFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_FILES) {
    throwFail('PORTFOLIO_FILES_INVALID', `Portfolio requires 1–${MAX_FILES} files.`);
  }
  const normalized = files.map((file, index) => {
    if (!file || typeof file !== 'object') throwFail('PORTFOLIO_FILES_INVALID', `files[${index}] is invalid.`);
    const name = String(file.name ?? '').trim();
    if (!name || name.length > MAX_NAME || name.includes('/') || name.includes('\\') || name.includes('\0')) {
      throwFail('PORTFOLIO_NAME_INVALID', `files[${index}].name is not a safe file name.`);
    }
    const bytes = Buffer.isBuffer(file.bytes) ? file.bytes : Buffer.from(file.bytes ?? []);
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) {
      throwFail('PORTFOLIO_FILE_TOO_LARGE', `files[${index}] must be 1–${MAX_FILE_BYTES} bytes.`);
    }
    return {
      name,
      bytes,
      description: String(file.description ?? '').slice(0, 200),
      sha256: sha256(bytes),
      size: bytes.length,
    };
  });
  const names = new Set();
  for (const file of normalized) {
    if (names.has(file.name.toLowerCase())) throwFail('PORTFOLIO_NAME_COLLISION', `Duplicate portfolio file name: ${file.name}`);
    names.add(file.name.toLowerCase());
  }
  return normalized;
}

function normalizePortfolioOptions(options = {}) {
  const title = String(options.title ?? 'PDF Portfolio').slice(0, 120);
  const view = ['D', 'T', 'H'].includes(options.view) ? options.view : 'D';
  const schema = Array.isArray(options.schema) && options.schema.length
    ? options.schema.slice(0, 8).map((field, i) => ({
      key: String(field.key ?? `F${i + 1}`).replace(/[^A-Za-z0-9]/g, '').slice(0, 16) || `F${i + 1}`,
      title: String(field.title ?? field.key ?? `Field ${i + 1}`).slice(0, 40),
    }))
    : [{ key: 'Desc', title: 'Description' }, { key: 'Size', title: 'Size' }];
  return { title, view, schema };
}

export function createPdfPortfolio(files, options = {}) {
  const normalized = normalizePortfolioFiles(files);
  const { title, view, schema } = normalizePortfolioOptions(options);
  const pdf = assemblePortfolioPdf({ files: normalized, title, view, schema });
  return freezeDeep({
    bytes: pdf,
    sha256: sha256(pdf),
    size: pdf.length,
    title,
    view,
    schema,
    files: normalized.map(({ name, size, sha256: digest, description }) => ({ name, size, sha256: digest, description })),
    pageMode: 'UseAttachments',
    collection: true,
  });
}
