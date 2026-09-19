import { httpText } from './fetcher.js';
import { GITHUB_TOKEN } from '../config.js';

export function parseRepo(url) {
  const pathname = new URL(url).pathname;
  const m = pathname.match(/^\/([^/]+)\/([^/]+)/);
  if (!m) return null;
  const [, owner, repoRaw] = m;
  const repo = repoRaw.replace(/\.git$/, '');
  const skip = ['topics', 'orgs', 'search', 'settings', 'notifications', 'features', 'about', 'sponsors', 'marketplace'];
  if (!owner || !repo || skip.includes(owner)) return null;
  return { owner, repo };
}

export async function fetchGitHub(url) {
  const r = parseRepo(url);
  if (!r) throw new Error('not a repo url');
  const headers = {
    accept: 'application/vnd.github+json',
    ...(GITHUB_TOKEN ? { authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
  };
  const api = (p) => `https://api.github.com${p}`;
  const metaRes = await httpText(api(`/repos/${r.owner}/${r.repo}`), { headers });
  const meta = JSON.parse(metaRes.text);
  if (!meta.full_name) throw new Error('unexpected GitHub API response');
  let readme = '';
  try {
    readme = (
      await httpText(api(`/repos/${r.owner}/${r.repo}/readme`), {
        headers: { ...headers, accept: 'application/vnd.github.raw+json' },
      })
    ).text.slice(0, 4000);
  } catch {
    // repo may have no README
  }
  return {
    source: 'github',
    title: meta.full_name,
    description: meta.description || '',
    siteName: 'GitHub',
    bodyText: readme,
    extra: {
      stars: meta.stargazers_count,
      language: meta.language,
      topics: (meta.topics || []).slice(0, 8),
    },
    good: true,
  };
}
