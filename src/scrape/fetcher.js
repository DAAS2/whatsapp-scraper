const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export async function httpText(url, { headers = {}, timeoutMs = 15_000, maxBytes = 2_000_000 } = {}) {
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      ...headers,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  if (/^image\//.test(contentType)) return { status: res.status, contentType, text: '' };
  if (!res.body) return { status: res.status, contentType, text: '' };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      break;
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return { status: res.status, contentType, text };
}
