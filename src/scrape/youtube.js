import { httpText } from './fetcher.js';

export function youtubeId(url) {
  const u = new URL(url);
  if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1).split('/')[0] || null;
  const v = u.searchParams.get('v');
  if (v) return v;
  const m = u.pathname.match(/\/(shorts|embed|live)\/([^/]+)/);
  return m?.[2] || null;
}

export async function fetchYouTube(url) {
  const id = youtubeId(url);
  if (!id) throw new Error('not a video url');
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;
  const j = JSON.parse((await httpText(oembed)).text);
  return {
    source: 'youtube',
    title: j.title,
    description: '',
    siteName: `YouTube · ${j.author_name}`,
    bodyText: '',
    extra: { videoId: id, channel: j.author_name },
    good: true,
  };
}
