import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { crc32, readZipEntries } from '../../src/host/platform/storage/formats/zip-reader.mjs';

const NAME = Buffer.from('word/document.xml');

function zipWithDeclaredSize(data, declaredSize) {
  const compressed = deflateRawSync(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(declaredSize, 22); local.writeUInt16LE(NAME.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10); central.writeUInt32LE(crc32(data), 16); central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(declaredSize, 24); central.writeUInt16LE(NAME.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + NAME.length, 12);
  end.writeUInt32LE(local.length + NAME.length + compressed.length, 16);
  return Buffer.concat([local, NAME, compressed, central, NAME, end]);
}

test('ZIP reader returns honest deflated entries, including empty ones', () => {
  assert.equal(readZipEntries(zipWithDeclaredSize(Buffer.from('hello'), 5)).get(NAME.toString()).toString(), 'hello');
  assert.equal(readZipEntries(zipWithDeclaredSize(Buffer.alloc(0), 0)).get(NAME.toString()).length, 0);
});

test('ZIP reader stops inflating at the declared size instead of expanding a lying entry', () => {
  // 8 MiB of zeros deflates to ~8 KiB, so a declared 1 KiB passes the ratio check.
  const bomb = zipWithDeclaredSize(Buffer.alloc(8 * 1024 * 1024), 1024);
  assert.throws(() => readZipEntries(bomb), { code: 'INVALID_ARCHIVE', message: 'The ZIP entry could not be decompressed.' });
});
