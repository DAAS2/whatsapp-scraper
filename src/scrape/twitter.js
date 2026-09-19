import { httpText } from './fetcher.js';

export async function fetchTwitter(url) {
  const pathname = new URL(url).pathname;
  if (!/\/status\/\d+/.test(pathname)) throw new Error('not a tweet url');
  const res = await httpText(`https://api.fxtwitter.com${pathname}`, {
    headers: { accept: 'application/json' },
  });
  const j = JSON.parse(res.text);
  const t = j?.tweet;
  if (!t) throw new Error('no tweet data');
  return {
    source: 'twitter',
    title: `${t.author?.name || t.author?.screen_name || 'Unknown'} on X`,
    description: (t.text || '').slice(0, 600),
    siteName: 'X (Twitter)',
    bodyText: '',
    extra: { likes: t.likes?.count, retweets: t.retweets?.count },
    good: true,
  };
}
