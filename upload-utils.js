function parseMultipartFormData(body, boundary) {
  if (!Buffer.isBuffer(body)) {
    body = Buffer.from(body);
  }

  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  const raw = body.toString('binary');

  for (const part of raw.split(delimiter).slice(1)) {
    if (!part || part.includes('--')) {
      continue;
    }

    const [, headersAndData] = part.split(/\r\n\r\n/, 2);
    const [headersText, dataText] = headersAndData.split(/\r\n\r\n/, 2);
    const headers = {};

    for (const line of headersText.split(/\r\n/)) {
      if (!line) continue;
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) continue;
      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();
      headers[key] = value;
    }

    const contentDisposition = headers['content-disposition'] || '';
    const nameMatch = contentDisposition.match(/name="([^"]+)"/);
    const filenameMatch = contentDisposition.match(/filename="([^"]*)"/);
    const data = Buffer.from((dataText || '').replace(/\r\n$/, ''), 'binary');

    parts.push({
      name: nameMatch ? nameMatch[1] : '',
      filename: filenameMatch ? filenameMatch[1] : '',
      contentType: headers['content-type'] || '',
      data
    });
  }

  return parts;
}

module.exports = {
  parseMultipartFormData
};
