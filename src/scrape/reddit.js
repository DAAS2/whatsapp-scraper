import { httpText } from './fetcher.js';

export async function fetchReddit(url) {
  const pathname = new URL(url).pathname.replace(/\/$/, '');
  if (!/\/comments\//.test(pathname) && !pathname.startsWith('/r/')) throw new Error('not a post url');
  const res = await httpText(`https://www.reddit.com${pathname}.json?limit=1`, {
    headers: { accept: 'application/json' },
  });
  const j = JSON.parse(res.text);
  const d = (Array.isArray(j) ? j[0]?.data?.children?.[0]?.data : j?.data?.children?.[0]?.data) || null;
  if (!d) throw new Error('no reddit data');
  return {
    source: 'reddit',
    title: d.title,
    description: (d.selftext || d.url_overridden_by_dest || '').slice(0, 800),
    siteName: `Reddit r/${d.subreddit}`,
    bodyText: '',
    extra: { score: d.score, comments: d.num_comments },
    good: true,
  };
}
