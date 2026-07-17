const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMultipartFormData } = require('../upload-utils');

test('parses a multipart upload with a file part', () => {
  const boundary = '----boundary';
  const body = Buffer.from(
    `--${boundary}\r\n` +
    'Content-Disposition: form-data; name="file"; filename="photo.png"\r\n' +
    'Content-Type: image/png\r\n\r\n' +
    'hello world\r\n' +
    `--${boundary}--\r\n`
  );

  const parts = parseMultipartFormData(body, boundary);

  assert.equal(parts.length, 1);
  assert.equal(parts[0].name, 'file');
  assert.equal(parts[0].filename, 'photo.png');
  assert.equal(parts[0].contentType, 'image/png');
  assert.equal(parts[0].data.toString('utf8'), 'hello world');
});
