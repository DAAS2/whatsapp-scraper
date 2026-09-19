import { httpText } from './fetcher.js';

export async function fetchNpm(url) {
  const m = new URL(url).pathname.match(/^\/package\/([^/]+)/);
  if (!m) throw new Error('not a package url');
  const name = m[1];
  const j = JSON.parse((await httpText(`https://registry.npmjs.org/${encodeURIComponent(name)}`)).text);
  const latest = j['dist-tags']?.latest;
  const v = latest ? j.versions?.[latest] : null;
  return {
    source: 'npm',
    title: `${j.name} (npm)`,
    description: (v?.description || j.description || '').slice(0, 400),
    siteName: 'npm',
    bodyText: (v?.readme || '').slice(0, 1500),
    extra: { version: latest, weeklyDownloads: undefined },
  };
}

export async function fetchPypi(url) {
  const m = new URL(url).pathname.match(/^\/project\/([^/]+)/);
  if (!m) throw new Error('not a package url');
  const name = m[1];
  const j = JSON.parse((await httpText(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`)).text);
  return {
    source: 'pypi',
    title: `${j.info?.name || name} (PyPI)`,
    description: (j.info?.summary || j.info?.description || '').slice(0, 400),
    siteName: 'PyPI',
    bodyText: '',
    extra: { version: j.info?.version },
  };
}
