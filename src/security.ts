export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_REMOTE_BYTES = 10 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 15_000;

const spreadsheetFilePattern = /\.(xlsx|xls|csv)$/i;

function isApprovedHost(hostname: string) {
  return hostname === 'docs.google.com' || hostname.endsWith('.googleusercontent.com');
}

export function validateSpreadsheetFile(file: File) {
  if (!spreadsheetFilePattern.test(file.name)) {
    throw new Error('Selecione um arquivo .xlsx, .xls ou .csv.');
  }
  if (file.size === 0) throw new Error('O arquivo está vazio.');
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('A planilha excede o limite de 15 MB.');
  }
}

export function validatePublishedSheetUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Informe uma URL válida de planilha publicada.');
  }

  if (url.protocol !== 'https:' || url.username || url.password || !isApprovedHost(url.hostname)) {
    throw new Error('Use uma URL HTTPS publicada pelo Google Sheets.');
  }
  return url;
}

export async function fetchPublishedCsv(input: string): Promise<string> {
  const url = validatePublishedSheetUrl(input);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('Fonte indisponível.');
    validatePublishedSheetUrl(response.url);

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_REMOTE_BYTES) {
      throw new Error('A planilha publicada excede o limite de 10 MB.');
    }
    return readLimitedText(response, MAX_REMOTE_BYTES);
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('A planilha publicada excede o limite de 10 MB.');
      }
      output += decoder.decode(value, { stream: true });
    }
    return output + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
